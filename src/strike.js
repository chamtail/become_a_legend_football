/* ============================================================
 *  strike.js — 射门 / 传球（两段式操作）
 *
 *  ① 方向：从球出发划一下，只取方向（长度/力度不参与判定）
 *  ② 触球点：给一个球的近景，球会原地跳 / 横向滚动 / 斜向移动 / 静止，
 *     速度随机。玩家点击球的某个位置，离球心越远：
 *        弧线越大、球飞得越高、也越难控制（精度惩罚越大）
 *  ③ 飞行：按方向 + 弧线 + 高度模拟，防守球员能挡低平球，
 *     门将按「出脚瞬间的直线方向」预判扑救 —— 所以弧线才能真正骗过他
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';
  var P = BL.Px, U = BL.U, S = BL.Scenes;

  var SHOT_SPEED = 215;      /* 射门球速 */
  var PASS_SPEED = 152;      /* 传球球速 */
  var GRAV = 82;             /* 视觉重力 */
  var LOFT_K = 92;           /* 触球点离球心越远，起球越高 */
  var CURVE_K = 340;         /* 弧线侧向加速度 */
  var CROSSBAR = 26;         /* 横梁高度（超过就是打高） */
  var KEEPER_REACH_H = 13;   /* 门将能封到的高度 */
  var BLOCK_H = 9;           /* 防守球员能挡到的高度 */
  var CB = { x: 152, y: 80 };/* 近景球的中心（世界坐标） */
  var CR = 28;               /* 近景球半径 */

  S.buildStrike = function (cfg) {
    var kind = cfg.kind === 'pass' ? 'pass' : 'shoot';
    var skill = cfg.skill, diff = cfg.diff;
    var isPass = kind === 'pass';

    var s = S.Base({
      type: kind,
      title: isPass ? '传球选择' : '射门机会',
      attr: isPass ? 'passing' : 'shooting',
      diff: diff, skill: skill, kit: cfg.kit, oppKit: cfg.oppKit, skin: cfg.skin, hair: cfg.hair,
      timeLimit: 2.6 + skill * 1.3
    });

    s.stage = 'aim';                 /* aim -> touch -> fly */
    s.ball = cfg.ball || (isPass ? { x: U.rnd(112, 148), y: U.rnd(52, 108) }
                                : { x: U.rnd(146, 180), y: U.rnd(50, 110) });
    s.player = { x: s.ball.x - 9, y: s.ball.y + 5 };
    s.dir = null; s.curve = 0; s.power = 0; s.shot = null; s.contact = null;
    s.aimNow = null;
    s.defs = []; s.mates = []; s.keeper = null; s.motion = null;
    s.blocked = false; s.outcome = null;

    /* ---------- 场景布置 ---------- */
    var i, n;
    if (isPass) {
      var ys = U.shuffle([U.rnd(30, 48), U.rnd(66, 92), U.rnd(110, 132)]);
      for (i = 0; i < 3; i++) {
        s.mates.push({ x: U.rnd(178, 238), y: ys[i], vx: U.rnd(-5, 9), vy: U.rnd(-7, 7) });
      }
      n = 2 + (diff > 0.72 ? 1 : 0);
      for (i = 0; i < n; i++) {
        s.defs.push({ x: U.rnd(s.ball.x + 26, 224), y: U.rnd(32, 128), tr: 7, vy: U.rnd(-8, 8) });
      }
      /* 最空的队友 = 目标 */
      var best = 0, bs = -1;
      s.mates.forEach(function (m, idx) {
        var clear = 999;
        s.defs.forEach(function (d) { clear = Math.min(clear, P.dist(m, d)); });
        clear += (m.x - 178) * 0.3;
        if (clear > bs) { bs = clear; best = idx; }
      });
      s.targetIdx = best;
    } else {
      s.keeper = { x: 239, y: 80, amp: 14 + diff * 7, spd: 0.9 + diff * 1.1, ph: U.rnd(0, 6), diveY: 80, dived: false };
      n = 2 + (diff > 0.7 ? 1 : 0);
      for (i = 0; i < n; i++) {
        s.defs.push({
          x: U.clamp(s.ball.x + 24 + i * U.rnd(24, 40), 150, 228),
          y: U.rnd(34, 126), tr: 7, vy: U.rnd(-7, 7)
        });
      }
    }

    /* ---------- 近景球的运动方式 ---------- */
    s.setupMotion = function () {
      var kinds = ['still', 'bob', 'rollX', 'rollY', 'diag', 'circle'];
      var k = kinds[U.rndInt(0, kinds.length - 1)];
      /* 对手越强、能力越低，球动得越快 */
      var spd = U.rnd(1.1, 2.2) + diff * 1.1 - skill * 0.5;
      s.motion = { kind: k, spd: Math.max(0.7, spd), ph: U.rnd(0, 6.28), ax: 0, ay: 0 };
    };
    s.motionPos = function () {
      var m = s.motion;
      if (!m) return { x: CB.x, y: CB.y };
      var t = s.t * m.spd + m.ph;
      var ax = 0, ay = 0;
      if (m.kind === 'bob') ay = Math.sin(t) * 9;
      else if (m.kind === 'rollX') ax = Math.sin(t) * 15;
      else if (m.kind === 'rollY') ay = Math.sin(t) * 11;
      else if (m.kind === 'diag') { ax = Math.sin(t) * 13; ay = Math.sin(t * 1.4) * 9; }
      else if (m.kind === 'circle') { ax = Math.cos(t) * 13; ay = Math.sin(t) * 9; }
      return { x: CB.x + ax, y: CB.y + ay };
    };

    /* ---------- 输入 ---------- */
    s.onDown = function (pt) {
      if (s.phase === 'result') { s.skipResult(); return; }
      if (s.phase !== 'draw') return;
      if (s.stage === 'aim') {
        if (P.dist(pt, s.ball) > 48) { s.warnT = 1.0; return; }
        s.started = true; s.pts = [pt]; s.drawing = true;
      } else if (s.stage === 'touch') {
        s.takeContact(pt);
      }
    };
    s.onMove = function (pt) {
      if (s.phase !== 'draw') return;
      if (s.stage === 'aim' && s.drawing) {
        var last = s.pts[s.pts.length - 1];
        if (!last || P.dist(last, pt) > 1.6) s.pts.push(pt);
        if (s.pts.length > 1) {
          var a = s.pts[0], b = pt;
          var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
          s.aimNow = { x: dx / L, y: dy / L };
        }
      }
    };
    s.onUp = function () {
      if (s.phase !== 'draw' || s.stage !== 'aim' || !s.drawing) return;
      s.drawing = false;
      if (s.pts.length < 2) return;
      var a = s.pts[0], b = s.pts[s.pts.length - 1];
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy);
      if (L < 20) { s.warnT = 1.0; s.started = false; s.pts = []; return; }
      s.dir = { x: dx / L, y: dy / L };
      if (s.dir.x < 0.25) { s.finish({ quality: 0, text: '方向完全偏了', detail: '朝着球门方向划出轨迹' }); return; }
      s.stage = 'touch';
      s.pts = []; s.aimNow = null;
      s.drawT = 0;
      s.timeLimit = 1.5 + skill * 1.0;    /* 触球点要在球移动时点中 */
      s.setupMotion();
    };

    /* 触球点判定 */
    s.takeContact = function (pt) {
      if (s.stage !== 'touch') return;
      var c = s.motionPos();
      var off = { x: pt.x - c.x, y: pt.y - c.y };
      var d = Math.sqrt(off.x * off.x + off.y * off.y);
      if (d > CR * 1.45) {
        s.finish({ quality: 0, text: '踢疵了！', detail: '要点在球上，离线越远弧线越大' , outcome: 'mishit' });
        return;
      }
      var perp = { x: -s.dir.y, y: s.dir.x };
      var along = (off.x * perp.x + off.y * perp.y) / CR;   /* 触球点在法线上的投影 */
      s.curve = U.clamp(along, -1, 1);
      s.power = U.clamp(d / CR, 0, 1);
      s.contact = { x: off.x / CR, y: off.y / CR };
      s.startFlight();
    };

    /* ---------- 飞行 ---------- */
    s.startFlight = function () {
      var perp = { x: -s.dir.y, y: s.dir.x };
      var speed = isPass ? PASS_SPEED : SHOT_SPEED;
      /* 弧线越大越难控制 */
      var err = Math.abs(s.curve) * (1.0 - skill * 0.55) * 0.16;
      var e = U.rnd(-err, err);
      var dx = s.dir.x + perp.x * e, dy = s.dir.y + perp.y * e;
      var L = Math.sqrt(dx * dx + dy * dy) || 1;
      s.shot = {
        x: s.ball.x, y: s.ball.y, h: 0,
        vx: dx / L * speed, vy: dy / L * speed,
        vh: Math.abs(s.curve) * LOFT_K,
        curve: s.curve, perp: perp, t: 0, trail: [{ x: s.ball.x, y: s.ball.y }]
      };
      if (s.keeper) {
        /* 门将只看得出脚那一瞬的直线方向 */
        var predY = s.ball.y + s.dir.y / Math.max(0.2, s.dir.x) * (P.LINE - s.ball.x);
        var read = U.clamp(0.14 + diff * 0.46 - skill * 0.34, 0.05, 0.7);
        s.keeper.diveY = U.clamp(predY + (1 - read) * U.rnd(-32, 32), P.GOAL_TOP + 2, P.GOAL_BOT - 2);
        s.keeper.read = read;
        s.keeper.dived = true;
      }
      s.stage = 'fly';
      s.locked = true;
    };

    s.onTimeout = function () {
      if (s.stage === 'aim') s.finish({ quality: 0, text: '犹豫太久，机会溜走了', detail: '先划出方向' });
      else if (s.stage === 'touch') s.finish({ quality: 0, text: '没碰到球，被对手破坏了', detail: '要在球移动时点中触球点' });
    };

    /* ---------- 判定 ---------- */
    function evalShot(sh) {
      var overBar = sh.h > CROSSBAR;
      var inGoal = sh.y > P.GOAL_TOP && sh.y < P.GOAL_BOT;
      if (overBar) return { quality: 0, text: '打高了！', detail: '触球点太靠边，球飞过了横梁', outcome: 'over' };
      if (!inGoal) return { quality: 0, text: '偏出球门', detail: sh.y <= P.GOAL_TOP ? '偏向上角外侧' : '偏向下角外侧', outcome: 'wide' };
      /* 门将 */
      var ky = s.keeper ? s.keeper.y : 80;
      var reach = U.clamp(11 + diff * 4 - skill * 3.2, 6, 18);
      var canReach = sh.h < KEEPER_REACH_H;
      var saved = canReach && Math.abs(sh.y - ky) < reach;
      if (saved) return { quality: 0, text: '被门将扑出！', detail: '他猜对了方向 —— 试试加大弧线', outcome: 'save' };
      var q = (Math.abs(s.curve) > 0.45 && sh.h > KEEPER_REACH_H) ? 2 : 1;
      return { quality: q, text: '球进了！！', detail: q >= 2 ? '弧线球绕过门将，死角！' : '干净利落的射门', outcome: 'goal' };
    }

    s.update = function (dt) {
      s.tick(dt);
      if (s.warnT > 0) s.warnT -= dt;

      /* 防守球员轻微移动（只在瞄准阶段，方便玩家预判） */
      if (s.stage === 'aim' || s.stage === 'touch') {
        s.defs.forEach(function (d) {
          d.y += d.vy * dt;
          if (d.y < 32) { d.y = 32; d.vy *= -1; }
          if (d.y > 128) { d.y = 128; d.vy *= -1; }
        });
        if (isPass) {
          s.mates.forEach(function (m) {
            m.x = U.clamp(m.x + m.vx * dt, 172, P.LINE - 6);
            m.y = U.clamp(m.y + m.vy * dt, 26, 134);
            if (m.y <= 26 || m.y >= 134) m.vy *= -1;
            if (m.x <= 172 || m.x >= P.LINE - 6) m.vx *= -1;
          });
        }
      }
      if (s.keeper && !s.keeper.dived) {
        s.keeper.y = 80 + Math.sin(s.t * s.keeper.spd + s.keeper.ph) * s.keeper.amp;
      } else if (s.keeper && s.stage === 'fly') {
        var kspd = 60 + diff * 40;
        var d2 = s.keeper.diveY - s.keeper.y;
        s.keeper.y += U.clamp(d2, -kspd * dt, kspd * dt);
      }

      var sh = s.shot;
      if (!sh || s.stage !== 'fly') return;
      sh.t += dt;
      sh.vx += sh.perp.x * sh.curve * CURVE_K * dt;
      sh.vy += sh.perp.y * sh.curve * CURVE_K * dt;
      /* 传球会滚动减速，最后停在队友附近 */
      if (isPass) {
        var sp = Math.sqrt(sh.vx * sh.vx + sh.vy * sh.vy) || 0.001;
        var nsp = Math.max(0, sp - 130 * dt);
        sh.vx *= nsp / sp; sh.vy *= nsp / sp;
        sh.spd = nsp;
      }
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.vh -= GRAV * dt;
      sh.h += sh.vh * dt;
      if (sh.h < 0) { sh.h = 0; sh.vh = 0; }
      sh.trail.push({ x: sh.x, y: sh.y });
      if (sh.trail.length > 90) sh.trail.shift();

      /* 防守球员封堵：低平球才会被挡 */
      for (var i = 0; i < s.defs.length; i++) {
        var d = s.defs[i];
        if (sh.h < BLOCK_H && P.dist(sh, d) < d.tr) {
          s.finish({ quality: 0, text: '被防守球员挡出！', detail: '低平球被封堵 —— 用触球点把球搓起来', outcome: 'blocked' });
          return;
        }
      }
      /* 越界 */
      if (sh.y < 8 || sh.y > P.H - 8 || sh.x < 20) {
        s.finish({ quality: 0, text: isPass ? '传球出界' : '偏出球门', detail: '方向或弧线没控制好', outcome: 'out' });
        return;
      }
      /* 射门：过底线判定 */
      if (!isPass && sh.x >= P.LINE) { s.finish(evalShot(sh)); return; }
      if (!isPass && sh.x > P.LINE - 26 && sh.h > CROSSBAR) { s.finish(evalShot(sh)); return; }
      /* 传球：接球判定 —— 球滚动过程中路过谁就算传给谁 */
      if (isPass) {
        var best = null, bd = 1e9;
        s.mates.forEach(function (m, idx) {
          var dd = P.dist(sh, m);
          if (dd < bd) { bd = dd; best = idx; }
        });
        var catchR = 14 + skill * 9;
        if (bd < catchR) {
          if (best !== s.targetIdx) {
            s.finish({ quality: 1, text: '安全传球', detail: '但不是最好的选择', outcome: 'pass' });
          } else if (s.mates[best].x > 195) {
            s.finish({ quality: 2, text: '妙传！助攻到手', detail: '弧线绕开了防守', outcome: 'assist' });
          } else {
            s.finish({ quality: 1, text: '传球成功', detail: '', outcome: 'pass' });
          }
          return;
        }
        if ((sh.spd !== undefined && sh.spd < 16) || sh.t > 2.2) {
          s.finish({ quality: 0, text: '传球没人接到', detail: '球滚到了没人接应的位置', outcome: 'wayward' });
          return;
        }
      }
      if (!isPass && sh.t > 2.4) s.finish({ quality: 0, text: '球没到位置', detail: '', outcome: 'out' });
    };

    /* ---------- 绘制 ---------- */
    s.draw = function (g) {
      P.pitch(g);

      if (s.stage === 'touch') { s.drawCloseup(g); return; }

      /* 门将 */
      if (s.keeper) {
        P.player(g, s.keeper.x, s.keeper.y, ['#ffd166', '#2b3a49'], { skin: '#e8b48a', hair: '#3a2a1a', dir: -1 });
        P.text(g, 'GK', s.keeper.x - 11, s.keeper.y + 11, '#ffd166', 7);
      }
      /* 防守球员 */
      s.defs.forEach(function (d) {
        g.strokeStyle = 'rgba(224,85,85,0.5)'; g.lineWidth = 1;
        g.beginPath(); g.arc(d.x, d.y + 2, d.tr, 0, Math.PI * 2); g.stroke();
        P.player(g, d.x, d.y, s.oppKit, { skin: '#c98d5e', hair: '#1d1410', dir: -1, frame: Math.floor(s.t * 5 + d.x) });
      });
      /* 队友 */
      s.mates.forEach(function (m, i) {
        P.player(g, m.x, m.y, s.kit, { skin: s.skin, hair: s.hair, dir: -1, frame: Math.floor(s.t * 5 + i) });
      });
      if (isPass) {
        var tm = s.mates[s.targetIdx];
        g.strokeStyle = '#57cc72'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(tm.x, tm.y + 2, 14 + Math.sin(s.t * 6) * 1.5, 0, Math.PI * 2); g.stroke();
        P.text(g, '空档', tm.x - 8, tm.y - 25, '#57cc72', 7);
      } else {
        /* 球门目标区提示 */
        g.strokeStyle = 'rgba(255,224,102,0.55)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(P.LINE - 6, P.GOAL_TOP + 8, 10, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(P.LINE - 6, P.GOAL_BOT - 8, 10, 0, Math.PI * 2); g.stroke();
      }

      /* 球与球员 */
      var bp = s.shot ? { x: s.shot.x, y: s.shot.y } : s.ball;
      if (!s.shot) P.ball(g, s.ball.x, s.ball.y, 3);
      P.player(g, s.player.x, s.player.y, s.kit, { skin: s.skin, hair: s.hair, dir: 1, frame: Math.floor(s.t * 6), marker: '#57cc72' });

      /* 方向指示 */
      if (s.stage === 'aim') {
        var dir = s.aimNow;
        if (dir) {
          P.dashed(g, [{ x: s.ball.x, y: s.ball.y },
                       { x: s.ball.x + dir.x * 120, y: s.ball.y + dir.y * 120 }], '#ffe066', 4, 0.85);
        } else if (s.dir) {
          P.dashed(g, [{ x: s.ball.x, y: s.ball.y },
                       { x: s.ball.x + s.dir.x * 120, y: s.ball.y + s.dir.y * 120 }], '#ffe066', 4, 0.6);
        }
        if (s.pts.length > 1) P.trail(g, s.pts, { color: '#ffffff', glow: 'rgba(120,220,255,0.3)', width: 1.6 });
      }

      /* 飞行轨迹与带高度的球 */
      if (s.shot) {
        P.dashed(g, s.shot.trail, 'rgba(255,255,255,0.45)', 3, 0.8);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath(); g.ellipse(s.shot.x, s.shot.y + 2, 3.5, 1.6, 0, 0, Math.PI * 2); g.fill();
        P.ball(g, s.shot.x, s.shot.y - s.shot.h * 0.75, 3);
        if (s.shot.h > 1) P.text(g, '高度 ' + Math.round(s.shot.h), s.shot.x - 12, s.shot.y - s.shot.h * 0.75 - 16, '#ffe066', 6.5);
      }
    };

    /* 近景球 */
    s.drawCloseup = function (g) {
      g.fillStyle = 'rgba(4,10,14,0.72)';
      g.fillRect(0, 0, P.W, P.H);
      var c = s.motionPos();
      /* 球体 */
      g.fillStyle = '#20262b';
      g.beginPath(); g.arc(c.x, c.y, CR + 1.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f7f7f2';
      g.beginPath(); g.arc(c.x, c.y, CR, 0, Math.PI * 2); g.fill();
      /* 皮块纹理 */
      g.fillStyle = '#242424';
      g.beginPath(); g.arc(c.x, c.y, CR * 0.24, 0, Math.PI * 2); g.fill();
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 + 0.4;
        g.beginPath();
        g.arc(c.x + Math.cos(a) * CR * 0.66, c.y + Math.sin(a) * CR * 0.66, CR * 0.15, 0, Math.PI * 2);
        g.fill();
      }
      /* 中心十字 */
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(c.x - CR, c.y); g.lineTo(c.x + CR, c.y);
      g.moveTo(c.x, c.y - CR); g.lineTo(c.x, c.y + CR); g.stroke();
      /* 外圈提示环 */
      g.strokeStyle = 'rgba(255,224,102,0.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(c.x, c.y, CR + 1.5, 0, Math.PI * 2); g.stroke();
      /* 方向提示：箭头表示出球方向 */
      var d = s.dir || { x: 1, y: 0 };
      g.strokeStyle = '#57cc72'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(c.x - d.x * (CR + 10), c.y - d.y * (CR + 10));
      g.lineTo(c.x + d.x * (CR + 10), c.y + d.y * (CR + 10));
      g.stroke();
      P.text(g, '出球方向', c.x + d.x * (CR + 12) - 18, c.y + d.y * (CR + 12) - 4, '#57cc72', 6.5);
      P.text(g, '点击球的触球点', c.x, c.y + CR + 12, '#ffffff', 8, 'center');
      P.text(g, '越靠边缘：弧线越大 / 球越高 / 越难控制', c.x, c.y + CR + 24, '#b9c9d8', 6.5, 'center');
    };

    s.drawOverlay = function (g) {
      if (s.phase === 'draw' && s.stage === 'aim' && s.tip) {
        P.rect(g, 0, P.CH - 18, P.CW, 11, 'rgba(4,10,14,0.62)');
        P.text(g, '从球出发划出方向（只看方向，长度不重要）', 4, P.CH - 16, '#e8f2e8', 6.5);
      }
      if (s.warnT > 0) P.text(g, '起手要靠近球，划长一点！', s.ball.x, s.ball.y - 24, '#ff7b7b', 8, 'center');
      s.drawTimer(g);
      s.drawResult(g);
    };

    return s;
  };

  S.buildShoot = function (cfg) { cfg.kind = 'shoot'; return S.buildStrike(cfg); };
  S.buildPass = function (cfg) { cfg.kind = 'pass'; return S.buildStrike(cfg); };

})(window.BL);
