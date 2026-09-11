/* ============================================================
 *  scenes2.js — 划轨迹小游戏：盘带 / 防守 / 工厂
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';
  var P = BL.Px, U = BL.U;
  var S = BL.Scenes;

  /* 给基类补上「动画期间锁输入」的逻辑 */
  var _base = S.Base;
  S.Base = function (cfg) {
    var s = _base(cfg);
    var d = s.onDown, m = s.onMove, u = s.onUp;
    s.onDown = function (pt, t) { if (s.locked && s.phase !== 'result') return; d(pt, t); };
    s.onMove = function (pt, t) { if (s.locked && s.phase !== 'result') return; m(pt, t); };
    s.onUp = function (pt, t) { if (s.locked && s.phase !== 'result') return; u(pt, t); };
    return s;
  };

  /* ---------------- 盘带 ---------------- */
  S.buildDribble = function (cfg) {
    var skill = cfg.skill, diff = cfg.diff, pace = cfg.pace === undefined ? skill : cfg.pace;
    var start = { x: 78, y: U.rnd(50, 110) };
    var s = S.Base({
      type: 'dribble', title: '盘带突破', attr: 'dribbling',
      diff: diff, skill: skill, kit: cfg.kit, oppKit: cfg.oppKit, skin: cfg.skin, hair: cfg.hair,
      timeLimit: 2.2 + skill * 1.1 + pace * 0.9, tip: '划出跑动路线 → 绕开红色抢断圈，终点落在黄区'
    });
    s.ball = start;
    s.me = { x: start.x, y: start.y };
    s.speed = 62 + pace * 62;
    s.target = { x: U.rnd(202, 228), y: U.rnd(48, 112), r: 18 };
    var tr = U.clamp(10.5 + diff * 4.5 - skill * 7, 5, 17);
    s.defs = [];
    var n = 3 + Math.round(diff * 2);
    for (var i = 0; i < n; i++) {
      var x = 108 + i * (84 / Math.max(1, n - 1)) + U.rnd(-8, 8);
      s.defs.push({ x: U.clamp(x, 102, 194), y: U.rnd(34, 128), vy: (U.rnd() < 0.5 ? -1 : 1) * U.rnd(6, 15), tr: tr });
    }
    s.anim = null;
    s.minClear = 999;

    s.onTimeout = function () { s.finish({ quality: 0, text: '带球太慢，被包夹了', detail: '迅速划出突破路线' }); };

    s.onRelease = function () {
      var len = P.len(s.pts);
      if (len < 30) { s.finish({ quality: 0, text: '划动太短，没有形成突破', detail: '从球的位置向前划出跑动路线' }); return; }
      s.locked = true;
      s.anim = { s: 0, total: len, dur: U.clamp(len / s.speed, 0.4, 3.2), t: 0 };
      s.animStart = { x: s.me.x, y: s.me.y };
      /* 轨迹起点接上球员位置 */
      var head = [{ x: s.me.x, y: s.me.y }].concat(s.pts);
      s.path = P.resample(head, 3);
      s.anim.total = P.len(s.path);
      s.anim.dur = U.clamp(s.anim.total / s.speed, 0.4, 3.4);
    };

    s.update = function (dt) {
      s.tick(dt);
      /* 防守球员来回移动 */
      s.defs.forEach(function (d) {
        if (s.anim) return;
        d.y += d.vy * dt;
        if (d.y < 32) { d.y = 32; d.vy *= -1; }
        if (d.y > 128) { d.y = 128; d.vy *= -1; }
      });
      if (s.anim) {
        s.anim.t += dt;
        s.defs.forEach(function (d) {
          d.y += d.vy * dt;
          if (d.y < 32) { d.y = 32; d.vy *= -1; }
          if (d.y > 128) { d.y = 128; d.vy *= -1; }
        });
        var prog = U.clamp(s.anim.t / s.anim.dur, 0, 1);
        var pt = P.pointAt(s.path, s.anim.total * prog);
        s.me.x = pt.x; s.me.y = pt.y;
        for (var i = 0; i < s.defs.length; i++) {
          var d = s.defs[i], dist = P.dist(pt, d);
          s.minClear = Math.min(s.minClear, dist - d.tr);
          if (dist < d.tr) {
            s.anim = null;
            s.finish({ quality: 0, text: '球被断了！', detail: '轨迹碰到了红色抢断圈' , outcome: 'tackled' });
            return;
          }
        }
        if (prog >= 1) {
          s.anim = null;
          var inZone = P.dist(pt, s.target) <= s.target.r + 8;
          if (!inZone) s.finish({ quality: 0, text: '跑偏了，没形成威胁', detail: '终点要落在黄色区域', outcome: 'out' });
          else if (s.minClear > 5) s.finish({ quality: 2, text: '连过数人，杀入禁区！', detail: '干净利落的突破', outcome: 'great' });
          else s.finish({ quality: 1, text: '突破成功', detail: '惊险地穿过了防线', outcome: 'ok' });
        }
      }
    };

    s.draw = function (g) {
      P.pitch(g);
      P.zone(g, s.target.x, s.target.y, s.target.r, '#ffe066', s.t, true);
      P.text(g, '禁区', s.target.x - 10, s.target.y - s.target.r - 12, '#ffe066', 8);
      /* 抢断范围 */
      s.defs.forEach(function (d) {
        g.strokeStyle = s.anim ? 'rgba(224,85,85,0.9)' : 'rgba(224,85,85,0.55)';
        g.lineWidth = 1;
        g.beginPath(); g.arc(d.x, d.y + 2, d.tr, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(224,85,85,0.10)';
        g.beginPath(); g.arc(d.x, d.y + 2, d.tr, 0, Math.PI * 2); g.fill();
        P.player(g, d.x, d.y, s.oppKit, { skin: '#c98d5e', hair: '#1d1410', dir: -1, frame: Math.floor(s.t * 5 + d.x) });
      });
      if (!s.anim && s.pts.length > 1) P.trail(g, s.pts, { color: '#ffffff', glow: 'rgba(120,220,255,0.30)', width: 2, dots: true });
      if (s.anim && s.path) {
        P.dashed(g, s.path, '#57cc72', 3, 0.45);
        P.trail(g, [s.path[0], P.pointAt(s.path, s.anim.total * U.clamp(s.anim.t / s.anim.dur, 0, 1))],
                { color: 'rgba(87,204,114,0.85)', width: 2 });
      }
      P.ball(g, s.me.x + 7, s.me.y + 5, 3);
      P.player(g, s.me.x, s.me.y, s.kit, { skin: s.skin, hair: s.hair, dir: 1, frame: Math.floor(s.t * 9), marker: '#57cc72' });
      if (s.phase === 'draw' && !s.started) P.dashed(g, [{ x: s.me.x, y: s.me.y }, { x: s.target.x, y: s.target.y }], '#ffffff', 3, 0.18);
      s.drawStartHint(g);
    };
    return s;
  };

  /* ---------------- 防守 ---------------- */
  S.buildDefend = function (cfg) {
    var skill = cfg.skill, diff = cfg.diff, pace = cfg.pace === undefined ? skill : cfg.pace;
    var s = S.Base({
      type: 'defend', title: '防守拦截', attr: 'defending',
      diff: diff, skill: skill, kit: cfg.kit, oppKit: cfg.oppKit, skin: cfg.skin, hair: cfg.hair,
      timeLimit: 2.1 + pace * 0.9, tip: '划出拦截路线 → 在他前进的路线上截住他'
    });
    s.ball = cfg.ball || { x: U.rnd(110, 152), y: U.rnd(40, 120) };
    s.me = { x: s.ball.x, y: s.ball.y };
    s.att = { x: U.rnd(198, 220), y: U.rnd(42, 118) };
    var end = { x: 62, y: U.clamp(s.att.y + U.rnd(-52, 52), 30, 130) };
    var mid = { x: (s.att.x + end.x) / 2, y: (s.att.y + end.y) / 2 + U.rnd(-34, 34) };
    s.attPath = P.quad(s.att, mid, end, 28);
    s.attTotal = P.len(s.attPath);
    s.attSpeed = 52 + diff * 18;
    s.mySpeed = 60 + pace * 70;
    s.reach = 7 + skill * 8 + (cfg.physSkill || skill) * 2;
    s.preview = 52 + skill * 58;
    s.anim = null;

    s.onTimeout = function () { s.finish({ quality: 0, text: '犹豫了，对手已经杀过来', detail: '果断划出拦截路线' }); };

    s.onRelease = function () {
      var len = P.len(s.pts);
      if (len < 18) { s.finish({ quality: 0, text: '动作太短，没拦住', detail: '从自己位置划向对手的必经之路' }); return; }
      s.locked = true;
      s.path = P.resample([{ x: s.me.x, y: s.me.y }].concat(s.pts), 3);
      s.pathTotal = P.len(s.path);
      s.anim = { t: 0, myS: 0, attS: 0, dur: 6 };
      s.attPos = { x: s.att.x, y: s.att.y };
      s.hit = false;
    };

    s.update = function (dt) {
      s.tick(dt);
      if (!s.anim) return;
      s.anim.t += dt;
      s.anim.myS = Math.min(s.pathTotal, s.anim.myS + s.mySpeed * dt);
      s.anim.attS = Math.min(s.attTotal, s.anim.attS + s.attSpeed * dt);
      var mp = P.pointAt(s.path, s.anim.myS);
      var ap = P.pointAt(s.attPath, s.anim.attS);
      s.me.x = mp.x; s.me.y = mp.y;
      s.attPos = ap;
      var d = P.dist(mp, ap);
      if (d < s.reach) {
        var elapsed = s.anim.t;
        s.anim = null; s.locked = false;
        var deep = ap.x > 118 && elapsed < 1.25;
        s.finish(deep
          ? { quality: 2, text: '干净利落的抢断！', detail: '你在危险区域前断下了球', outcome: 'tackle' }
          : { quality: 1, text: '抢断成功', detail: '及时化解了这次进攻', outcome: 'tackle' });
        return;
      }
      if (s.anim.attS >= s.attTotal) {
        s.anim = null; s.locked = false;
        s.finish({ quality: 0, text: '被过掉了！', detail: '拦截路线没有碰到他的跑动路线', outcome: 'beat' });
        return;
      }
      if (s.anim.myS >= s.pathTotal && s.anim.attS > 6) {
        s.anim = null; s.locked = false;
        s.finish({ quality: 0, text: '扑空了', detail: '轨迹太短，没能碰到对手', outcome: 'miss' });
      }
    };

    s.draw = function (g) {
      P.pitch(g);
      /* 完整路线（暗）+ 可预判部分（亮） */
      if (s.phase === 'draw' || s.anim) {
        var from = s.anim ? s.anim.attS : 0;
        var tail = [];
        var total = s.attTotal, acc = 0;
        for (var i = 1; i < s.attPath.length; i++) {
          var seg = P.dist(s.attPath[i - 1], s.attPath[i]);
          if (acc + seg >= from) tail.push(s.attPath[i]);
          acc += seg;
        }
        P.dashed(g, tail, '#ff8a8a', 3, 0.22);
        var headPts = [], a2 = 0;
        for (var k = 1; k < tail.length; k++) {
          headPts.push(tail[k]);
          a2 += P.dist(tail[k - 1], tail[k]);
          if (a2 > s.preview) break;
        }
        if (headPts.length > 1) P.dashed(g, [s.attPath[0]].concat(headPts), '#ffd166', 4, 0.85);
      }
      /* 我方球员 */
      P.player(g, s.me.x, s.me.y, s.kit, { skin: s.skin, hair: s.hair, dir: 1, frame: Math.floor(s.t * 8), marker: '#57cc72' });
      g.strokeStyle = 'rgba(87,204,114,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.arc(s.me.x, s.me.y + 2, s.reach, 0, Math.PI * 2); g.stroke();
      /* 对手 */
      var ap = s.attPos || s.att;
      P.player(g, ap.x, ap.y, s.oppKit, { skin: '#c98d5e', hair: '#1d1410', dir: -1, frame: Math.floor(s.t * 9) });
      P.ball(g, ap.x + 7, ap.y + 5, 3);

      if (!s.anim && s.pts.length > 1) P.trail(g, s.pts, { color: '#ffffff', glow: 'rgba(120,220,255,0.30)', width: 2, dots: true });
      if (s.anim && s.path) P.dashed(g, s.path, 'rgba(87,204,114,0.5)', 3, 0.5);
      s.drawStartHint(g);
    };
    return s;
  };

  /* ---------------- 工厂 ---------------- */
  S.build = function (type, cfg) {
    /* cfg: {diff, attrs:{...}, kit, oppKit, skin, hair, ball} */
    var a = cfg.attrs;
    var skillOf = { shoot: 'shooting', pass: 'passing', dribble: 'dribbling', defend: 'defending' };
    var key = skillOf[type];
    var c = {
      diff: cfg.diff, kit: cfg.kit, oppKit: cfg.oppKit, skin: cfg.skin, hair: cfg.hair,
      skill: (a[key] || 40) / 99, pace: (a.pace || 40) / 99, physSkill: (a.physical || 40) / 99,
      ball: cfg.ball
    };
    if (type === 'shoot') return S.buildShoot(c);
    if (type === 'pass') return S.buildPass(c);
    if (type === 'dribble') return S.buildDribble(c);
    if (type === 'defend') return S.buildDefend(c);
    return S.buildShoot(c);
  };

})(window.BL);
