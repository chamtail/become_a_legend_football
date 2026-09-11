/* ============================================================
 *  scenes.js — 划轨迹小游戏：运行器 / 判定 / 射门 / 传球
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';
  var P = BL.Px, U = BL.U;
  var S = BL.Scenes = {};

  /* ---------------- 通用判定 ---------------- */
  S.judge = function (drawn, ideal, tolEnd, tolPath) {
    var last = drawn[drawn.length - 1];
    var endErr = P.dist(last, ideal[ideal.length - 1]);
    var endScore = U.clamp(1 - endErr / tolEnd, 0, 1);
    var devSum = 0, n = 0, step = Math.max(1, Math.floor(drawn.length / 22));
    for (var i = 0; i < drawn.length; i += step) { devSum += P.distToPath(drawn[i], ideal); n++; }
    var avgDev = devSum / Math.max(1, n);
    var pathScore = U.clamp(1 - avgDev / tolPath, 0, 1);
    var dl = P.len(drawn), il = P.len(ideal);
    var ratio = il > 0 ? dl / il : 0;
    var powScore = U.clamp(1 - Math.abs(ratio - 1) / 0.7, 0, 1);
    return {
      endErr: endErr, endScore: endScore, avgDev: avgDev, pathScore: pathScore,
      powScore: powScore, ratio: ratio,
      total: 0.45 * endScore + 0.35 * pathScore + 0.20 * powScore
    };
  };

  S.tolEnd = function (skill, diff) { return (7 + 25 * skill) * (1.28 - 0.45 * diff); };
  S.tolPath = function (skill, diff) { return (9 + 23 * skill) * (1.28 - 0.42 * diff); };
  S.guideFrac = function (skill, diff) { return U.clamp(0.22 + skill * 0.62 - diff * 0.12, 0.2, 0.94); };

  S.qualityLabel = function (q) { return q >= 2 ? '精彩' : q === 1 ? '成功' : '失败'; };
  S.qualityClass = function (q) { return q >= 2 ? 'ok2' : q === 1 ? 'ok1' : 'ok0'; };

  /* 沿路径截取前 frac 比例的部分 */
  S.head = function (pts, frac) {
    var total = P.len(pts), target = total * frac, acc = 0, out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var d = P.dist(pts[i - 1], pts[i]);
      if (acc + d >= target) {
        out.push(P.pointAt(pts, target));
        break;
      }
      out.push(pts[i]); acc += d;
    }
    if (out.length < 2) out.push(pts[1] || pts[0]);
    return out;
  };

  /* ---------------- 运行器 ---------------- */
  var Run = BL.Run = {
    raf: null, scene: null, canvas: null, g: null, hooks: null,
    running: false, last: 0, time: 0,

    start: function (canvas, scene, hooks) {
      Run.stop();
      Run.canvas = canvas; Run.g = canvas.getContext('2d');
      canvas.width = P.CW; canvas.height = P.CH;
      Run.g.imageSmoothingEnabled = false;
      Run.scene = scene; Run.hooks = hooks;
      Run.running = true; Run.time = 0; Run.last = 0;
      scene.api = {
        done: function (res) { Run.finish(res); },
        hint: function (t) { if (hooks.onHint) hooks.onHint(t); },
        timer: function (v) { if (hooks.onTimer) hooks.onTimer(v); }
      };
      if (scene.init) scene.init(canvas, Run.g);
      if (hooks.onMeta) hooks.onMeta(scene);
      Run.bind(canvas);
      Run.raf = requestAnimationFrame(Run.frame);
    },

    stop: function () {
      Run.running = false;
      if (Run.raf) cancelAnimationFrame(Run.raf);
      Run.raf = null;
      if (Run.canvas) Run.unbind(Run.canvas);
    },

    finish: function (res) {
      Run.running = false;
      if (Run.raf) cancelAnimationFrame(Run.raf);
      Run.raf = null;
      if (Run.canvas) Run.unbind(Run.canvas);
      var h = Run.hooks, s = Run.scene;
      Run.scene = null;
      if (h && h.onDone) h.onDone(res, s);
    },

    frame: function (ts) {
      if (!Run.running) return;
      if (!Run.last) Run.last = ts;
      var dt = Math.min(0.05, (ts - Run.last) / 1000);
      Run.last = ts; Run.time += dt;
      var sc = Run.scene, g = Run.g;
      if (!sc) return;
      if (sc.update) sc.update(dt, Run.time);
      g.clearRect(0, 0, P.CW, P.CH);
      g.save(); g.translate(-P.VX, -P.VY);
      if (sc.draw) sc.draw(g, Run.time);
      g.restore();
      if (sc.drawOverlay) sc.drawOverlay(g, Run.time);
      Run.raf = requestAnimationFrame(Run.frame);
    },

    toLocal: function (e) {
      var r = Run.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width * P.CW + P.VX,
        y: (e.clientY - r.top) / r.height * P.CH + P.VY
      };
    },

    bind: function (cv) {
      Run._down = function (e) {
        e.preventDefault();
        if (cv.setPointerCapture && e.pointerId !== undefined) { try { cv.setPointerCapture(e.pointerId); } catch (x) {} }
        var sc = Run.scene; if (!sc) return;
        var pt = Run.toLocal(e);
        if (sc.onDown) sc.onDown(pt, Run.time);
      };
      Run._move = function (e) {
        e.preventDefault();
        var sc = Run.scene; if (!sc) return;
        var pt = Run.toLocal(e);
        if (sc.onMove) sc.onMove(pt, Run.time);
      };
      Run._up = function (e) {
        e.preventDefault();
        var sc = Run.scene; if (!sc) return;
        var pt = Run.toLocal(e);
        if (sc.onUp) sc.onUp(pt, Run.time);
      };
      cv.addEventListener('pointerdown', Run._down, { passive: false });
      cv.addEventListener('pointermove', Run._move, { passive: false });
      cv.addEventListener('pointerup', Run._up, { passive: false });
      cv.addEventListener('pointercancel', Run._up, { passive: false });
      cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },
    unbind: function (cv) {
      if (Run._down) cv.removeEventListener('pointerdown', Run._down);
      if (Run._move) cv.removeEventListener('pointermove', Run._move);
      if (Run._up) {
        cv.removeEventListener('pointerup', Run._up);
        cv.removeEventListener('pointercancel', Run._up);
      }
    }
  };

  /* ---------------- 场景基类 ---------------- */
  S.Base = function (cfg) {
    var s = {
      type: cfg.type, title: cfg.title, attr: cfg.attr,
      diff: cfg.diff, skill: cfg.skill, kit: cfg.kit, oppKit: cfg.oppKit,
      skin: cfg.skin, hair: cfg.hair,
      phase: 'draw', t: 0, drawT: 0, resultT: 0, hold: 1.5,
      pts: [], drawing: false, result: null, started: false,
      timeLimit: cfg.timeLimit, warn: false, tip: cfg.tip || ''
    };
    s.api = null;
    s.finish = function (res) {
      if (s.phase === 'result') return;
      s.result = res; s.phase = 'result'; s.resultT = 0;
      s.hold = res.quality >= 1 ? 1.35 : 1.7;
    };
    s.onDown = function (pt) {
      if (s.phase === 'result') { s.resultT = 99; return; }
      if (s.phase !== 'draw') return;
      if (!s.started) {
        /* 起点必须靠近球 */
        if (s.ball && P.dist(pt, s.ball) > 44) { s.startWarn = 0.9; return; }
        s.started = true; s.pts = [pt];
      } else {
        s.pts.push(pt);
      }
      s.drawing = true;
    };
    s.onMove = function (pt) {
      if (s.phase !== 'draw' || !s.drawing) return;
      var last = s.pts[s.pts.length - 1];
      if (!last || P.dist(last, pt) > 1.6) s.pts.push(pt);
    };
    s.onUp = function () {
      if (s.phase !== 'draw' || !s.drawing) return;
      s.drawing = false;
      if (s.pts.length < 2) return;
      s.pts = P.smooth(P.resample(s.pts, 3), 1);
      s.onRelease();
    };
    s.tick = function (dt) {
      s.t += dt;
      if (s.startWarn > 0) s.startWarn -= dt;
      if (s.phase === 'draw') {
        s.drawT += dt;
        if (s.drawT > s.timeLimit * 0.72) s.warn = true;
        if (s.drawT >= s.timeLimit && s.onTimeout) s.onTimeout();
      } else if (s.phase === 'result') {
        s.resultT += dt;
        if (s.resultT >= s.hold) { var r = s.result; s.phase = 'done'; s.api.done(r); }
      }
    };
    s.drawTimer = function (g) {
      if (s.phase !== 'draw') return;
      var f = U.clamp(1 - s.drawT / s.timeLimit, 0, 1);
      P.rect(g, 0, P.CH - 4, P.CW, 4, 'rgba(0,0,0,0.5)');
      P.rect(g, 0, P.CH - 4, P.CW * f, 4, s.warn ? '#e05555' : '#57cc72');
    };
    s.drawOverlay = function (g) {
      if (s.phase === 'draw' && !s.locked && s.tip) {
        P.rect(g, 0, P.CH - 22, P.CW, 14, 'rgba(4,10,14,0.6)');
        P.text(g, s.tip, 4, P.CH - 19, '#e8f2e8', 8);
      }
      s.drawTimer(g);
      s.drawResult(g);
    };
    s.drawResult = function (g) {
      if (s.phase !== 'result' || !s.result) return;
      var r = s.result;
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, 0, P.CW, P.CH);
      var col = r.quality >= 2 ? '#ffe066' : r.quality === 1 ? '#57cc72' : '#ff7b7b';
      P.text(g, S.qualityLabel(r.quality), P.CW / 2, 26, col, 20, 'center');
      P.text(g, r.text, P.CW / 2, 54, '#ffffff', 10, 'center');
      if (r.detail) P.text(g, r.detail, P.CW / 2, 70, '#b9c9d8', 8, 'center');
      P.text(g, '点击继续', P.CW / 2, P.CH - 18, '#7f93a8', 8, 'center');
    };
    s.drawStartHint = function (g) {
      if (s.phase !== 'draw') return;
      if (!s.started && s.ball) {
        P.zone(g, s.ball.x, s.ball.y, 8, '#ffe066', s.t, true);
        P.text(g, '按住这里起手', s.ball.x + 12, s.ball.y - 4, '#ffe066', 8);
      }
      if (s.startWarn > 0) P.text(g, '起手要靠近球！', s.ball.x, s.ball.y - 20, '#ff7b7b', 10, 'center');
    };
    return s;
  };

  /* ---------------- 射门 ---------------- */
  S.buildShoot = function (cfg) {
    var skill = cfg.skill, diff = cfg.diff;
    var ball = cfg.ball || { x: U.rnd(148, 184), y: U.rnd(46, 114) };
    var s = S.Base({
      type: 'shoot', title: '射门机会', attr: 'shooting',
      diff: diff, skill: skill, kit: cfg.kit, oppKit: cfg.oppKit, skin: cfg.skin, hair: cfg.hair,
      timeLimit: 2.5 + skill * 1.5, tip: '从球出发划出射门轨迹 → 终点落在黄色光圈内'
    });
    s.ball = ball;
    s.keeper = { x: 239, y: 80, amp: 15 + diff * 7, spd: 0.9 + diff * 1.1, ph: U.rnd(0, 6), diveY: 80, dived: false, reach: 0 };
    var top = U.rnd() < 0.5;
    s.target = { x: 244, y: top ? U.rnd(59, 71) : U.rnd(89, 101), r: 13 };
    var mid = { x: (ball.x + s.target.x) / 2, y: (ball.y + s.target.y) / 2 };
    var dx = s.target.x - ball.x, dy = s.target.y - ball.y;
    var L = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = -dy / L, py = dx / L;
    var k = U.rnd(12, 24);
    var c1 = { x: mid.x + px * k, y: mid.y + py * k };
    var c2 = { x: mid.x - px * k, y: mid.y - py * k };
    /* 让弧线绕开门将 */
    var kAt = 80;
    var d1 = Math.abs(c1.y - kAt), d2 = Math.abs(c2.y - kAt);
    s.ideal = P.quad(ball, d1 > d2 ? c1 : c2, s.target, 26);
    s.guide = S.head(s.ideal, S.guideFrac(skill, diff));
    s.defender = { x: ball.x + U.rnd(26, 44), y: U.clamp(ball.y + U.rnd(-26, 26), 30, 130) };
    s.ballAnim = null;

    s.onTimeout = function () { s.finish({ quality: 0, text: '犹豫太久，机会溜走了', detail: '对手回防到位' }); };

    s.onRelease = function () {
      var tolEnd = S.tolEnd(skill, diff), tolPath = S.tolPath(skill, diff);
      var j = S.judge(s.pts, s.ideal, tolEnd, tolPath);
      var end = s.pts[s.pts.length - 1];
      var len = P.len(s.pts);

      if (len < 26) { s.finish({ quality: 0, text: '划动太短，球没踢出去', detail: '从球的位置向后拉出轨迹' }); return; }

      /* 门将判断方向：猜对边才有机会扑到 */
      var read = U.clamp(0.08 + diff * 0.40 - skill * 0.40, 0.03, 0.70);
      var side = end.y < 80 ? -1 : 1;                    /* -1 上角 / +1 下角 */
      var sloppy = j.pathScore < 0.34 || j.ratio < 0.55;
      var correct = Math.random() < (sloppy ? Math.min(0.85, read * 2.2 + 0.15) : read);
      if (sloppy) reach0 = 1.25;
      var diveY = correct
        ? U.clamp(end.y + U.rnd(-13, 13), P.GOAL_TOP + 1, P.GOAL_BOT - 1)
        : (side > 0 ? P.GOAL_TOP + 5 : P.GOAL_BOT - 5);
      var reach0 = 1;
      var reach = U.clamp(11 + diff * 4 - skill * 4, 6, 19) * reach0;

      /* 完全偏出球门 */
      var offTarget = end.y < P.GOAL_TOP - 3 || end.y > P.GOAL_BOT + 3 || end.x < P.LINE - 16;
      var miss = offTarget || j.endErr > tolEnd * 1.9;
      var saved = !miss && correct && Math.abs(end.y - diveY) < reach;

      s.ballAnim = { pts: s.pts, t: 0, dur: U.clamp(len / 300, 0.22, 0.55) };
      s.keeper.diveY = diveY; s.keeper.dived = true; s.keeper.reach = reach;
      s.outcome = miss ? 'miss' : saved ? 'save' : 'goal';
      s.judgeRes = j;
    };

    s.update = function (dt) {
      s.tick(dt);
      if (!s.keeper.dived) {
        s.keeper.y = 80 + Math.sin(s.t * s.keeper.spd + s.keeper.ph) * s.keeper.amp;
      } else {
        s.keeper.y += (s.keeper.diveY - s.keeper.y) * Math.min(1, dt * 12);
      }
      if (s.ballAnim && s.phase === 'draw') {
        s.ballAnim.t += dt;
        if (s.ballAnim.t >= s.ballAnim.dur) {
          s.ballAnim = null;
          var j = s.judgeRes;
          if (s.outcome === 'goal') {
            var q = j.total >= 0.70 ? 2 : 1;
            s.finish({ quality: q, text: '球进了！！', detail: q >= 2 ? '世界波！门将毫无办法' : '干脆利落的射门', outcome: 'goal' });
          } else if (s.outcome === 'save') {
            s.finish({ quality: 0, text: '被门将扑出', detail: '射门太正 / 力量不足', outcome: 'save' });
          } else {
            s.finish({ quality: 0, text: '射偏了', detail: '终点要落在光标圈内', outcome: 'miss' });
          }
        }
      }
    };

    s.draw = function (g) {
      P.pitch(g);
      /* 门将 */
      var kx = s.keeper.x, ky = s.keeper.y;
      g.strokeStyle = 'rgba(255,120,120,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.arc(kx - 4, ky, s.keeper.dived ? s.keeper.reach : 12, 0, Math.PI * 2); g.stroke();
      P.player(g, kx, ky, ['#ffd166', '#2b3a49'], { skin: '#e8b48a', hair: '#3a2a1a', dir: -1, frame: 0 });
      P.text(g, 'GK', kx - 12, ky + 10, '#ffd166', 7);

      /* 防守球员 */
      P.player(g, s.defender.x, s.defender.y, s.oppKit, { skin: '#c98d5e', hair: '#1d1410', dir: -1, frame: 1 });

      /* 目标圈与指引 */
      P.zone(g, s.target.x, s.target.y, s.target.r, '#ffe066', s.t, true);
      if (s.phase === 'draw' && !s.started) P.dashed(g, s.guide, '#ffe066', 4, 0.8);
      else if (s.phase === 'draw') P.dashed(g, s.guide, '#ffe066', 4, 0.35);

      /* 球与球员 */
      if (!s.ballAnim) P.ball(g, s.ball.x, s.ball.y, 3);
      P.player(g, s.ball.x - 9, s.ball.y + 5, s.kit, { skin: s.skin, hair: s.hair, dir: 1, frame: Math.floor(s.t * 6) });
      if (s.ballAnim) P.ball(g, P.pointAt(s.ballAnim.pts, P.len(s.ballAnim.pts) * (s.ballAnim.t / s.ballAnim.dur)).x,
                                 P.pointAt(s.ballAnim.pts, P.len(s.ballAnim.pts) * (s.ballAnim.t / s.ballAnim.dur)).y, 3);

      if (s.pts.length > 1) P.trail(g, s.pts, { color: '#ffffff', glow: 'rgba(120,220,255,0.30)', width: 2, dots: true });
      s.drawStartHint(g);
    };
    return s;
  };

  /* ---------------- 传球 ---------------- */
  S.buildPass = function (cfg) {
    var skill = cfg.skill, diff = cfg.diff;
    var ball = cfg.ball || { x: U.rnd(112, 150), y: U.rnd(48, 112) };
    var s = S.Base({
      type: 'pass', title: '传球选择', attr: 'passing',
      diff: diff, skill: skill, kit: cfg.kit, oppKit: cfg.oppKit, skin: cfg.skin, hair: cfg.hair,
      timeLimit: 2.3 + skill * 1.4, tip: '划出传球路线 → 终点落在蓝色接球圈上'
    });
    s.ball = ball;

    /* 队友 */
    var ys = U.shuffle([U.rnd(30, 48), U.rnd(66, 92), U.rnd(110, 132)]);
    s.mates = [];
    for (var i = 0; i < 3; i++) {
      s.mates.push({ x: U.rnd(178, 238), y: ys[i], vx: U.rnd(-5, 9), vy: U.rnd(-7, 7), num: i });
    }
    /* 防守球员 */
    s.opps = [];
    var nd = 2 + (diff > 0.72 ? 1 : 0);
    for (var j = 0; j < nd; j++) {
      s.opps.push({ x: U.rnd(ball.x + 26, 226), y: U.rnd(32, 128), vy: U.rnd(-9, 9), vx: U.rnd(-4, 4) });
    }
    /* 选最空的队友作为目标 */
    var best = 0, bestScore = -1;
    s.mates.forEach(function (m, idx) {
      var clear = 999;
      s.opps.forEach(function (o) { clear = Math.min(clear, P.dist(m, o)); });
      clear += (m.x - 178) * 0.28;
      if (clear > bestScore) { bestScore = clear; best = idx; }
    });
    s.targetIdx = best;
    s.target = s.mates[best];
    s.leadTime = 0.6;
    s.moving = true;

    s.buildIdeal = function () {
      var end = { x: U.clamp(s.target.x + s.target.vx * s.leadTime, 10, P.LINE - 4), y: U.clamp(s.target.y + s.target.vy * s.leadTime, 8, P.H - 8) };
      var nearest = null, nd2 = 1e9;
      s.opps.forEach(function (o) {
        var d = P.distToSeg(o, ball, end);
        if (d < nd2) { nd2 = d; nearest = o; }
      });
      var mid = { x: (ball.x + end.x) / 2, y: (ball.y + end.y) / 2 };
      var dx = end.x - ball.x, dy = end.y - ball.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
      var px = -dy / L, py = dx / L;
      var k = U.clamp(16 - nd2 * 0.25, 0, 16);
      var c1 = { x: mid.x + px * k, y: mid.y + py * k }, c2 = { x: mid.x - px * k, y: mid.y - py * k };
      var use = nearest ? (P.dist(c1, nearest) > P.dist(c2, nearest) ? c1 : c2) : c1;
      s.ideal = P.quad(ball, use, end, 24);
      s.guide = S.head(s.ideal, S.guideFrac(skill, diff));
      s.idealEnd = end;
    };
    s.buildIdeal();

    s.onTimeout = function () { s.finish({ quality: 0, text: '出球太慢，被逼抢了', detail: '快速做出选择' }); };

    s.onRelease = function () {
      var tolEnd = S.tolEnd(skill, diff), tolPath = S.tolPath(skill, diff);
      var end = s.pts[s.pts.length - 1];
      var len = P.len(s.pts);
      if (len < 24) { s.finish({ quality: 0, text: '划动太短，球没传出去', detail: '' }); return; }

      /* 找最近的队友 */
      var pick = null, pd = 1e9;
      s.mates.forEach(function (m, idx) { var d = P.dist(end, m); if (d < pd) { pd = d; pick = idx; } });
      var rightMan = pick === s.targetIdx;

      /* 传球路线是否被挡 */
      var minDef = 1e9;
      s.opps.forEach(function (o) { minDef = Math.min(minDef, P.distToPath(o, s.pts)); });

      var idealFor = rightMan ? s.ideal : (function () {
        var m = s.mates[pick];
        return P.quad(ball, { x: (ball.x + m.x) / 2, y: (ball.y + m.y) / 2 }, m, 20);
      })();
      var j = S.judge(s.pts, idealFor, tolEnd, tolPath);
      s.judgeRes = j;
      s.ballAnim = { pts: s.pts, t: 0, dur: U.clamp(len / 280, 0.2, 0.5) };
      s.pickIdx = pick;
      s.minDef = minDef;

      if (pd > 34 && !rightMan) { s.outcome = 'wayward'; }
      else if (minDef < 9 && j.total < 0.78) { s.outcome = 'intercept'; }
      else if (!rightMan) { s.outcome = 'wrong'; }
      else if (j.total >= 0.66 && s.target.x > 192) { s.outcome = 'assist'; }
      else if (j.total >= 0.42) { s.outcome = 'ok'; }
      else { s.outcome = 'poor'; }
      s.moving = false;
    };

    s.update = function (dt) {
      s.tick(dt);
      if (s.moving && s.phase === 'draw') {
        s.mates.forEach(function (m) {
          m.x = U.clamp(m.x + m.vx * dt, 172, P.LINE - 6);
          m.y = U.clamp(m.y + m.vy * dt, 26, P.H - 26);
          if (m.y <= 26 || m.y >= P.H - 26) m.vy *= -1;
          if (m.x <= 172 || m.x >= P.LINE - 6) m.vx *= -1;
        });
        s.opps.forEach(function (o) {
          o.x = U.clamp(o.x + o.vx * dt, 150, P.LINE - 8);
          o.y = U.clamp(o.y + o.vy * dt, 26, P.H - 26);
          if (o.y <= 26 || o.y >= P.H - 26) o.vy *= -1;
          if (o.x <= 150 || o.x >= P.LINE - 8) o.vx *= -1;
        });
        s.buildIdeal();
      }
      if (s.ballAnim) {
        s.ballAnim.t += dt;
        if (s.ballAnim.t >= s.ballAnim.dur) {
          s.ballAnim = null;
          var j = s.judgeRes, o = s.outcome;
          if (o === 'assist') s.finish({ quality: 2, text: '助攻！', detail: '一脚穿透防线的直塞', outcome: 'assist' });
          else if (o === 'ok') s.finish({ quality: 1, text: '传球成功', detail: j.total >= 0.55 ? '漂亮的转移' : '安全出球', outcome: 'pass' });
          else if (o === 'wrong') s.finish({ quality: 0, text: '传给了被盯死的队友', detail: '绿色标记的队友才是空档', outcome: 'wrong' });
          else if (o === 'intercept') s.finish({ quality: 0, text: '传球被断', detail: '路线从防守球员脚下穿过', outcome: 'intercept' });
          else if (o === 'wayward') s.finish({ quality: 0, text: '传球失误，球出界了', detail: '终点要靠近队友', outcome: 'wayward' });
          else s.finish({ quality: 0, text: '传球质量太差', detail: '轨迹偏离了最佳路线', outcome: 'poor' });
        }
      }
    };

    s.draw = function (g) {
      P.pitch(g);
      /* 空档队友高亮 */
      var tm = s.mates[s.targetIdx];
      if (s.phase === 'draw') {
        g.strokeStyle = '#57cc72'; g.lineWidth = 1;
        g.beginPath(); g.arc(tm.x, tm.y + 2, 13 + Math.sin(s.t * 6) * 1.5, 0, Math.PI * 2); g.stroke();
        P.text(g, '空档', tm.x - 8, tm.y - 24, '#57cc72', 7);
      }
      s.opps.forEach(function (o) { P.player(g, o.x, o.y, s.oppKit, { skin: '#c98d5e', hair: '#1d1410', dir: -1 }); });
      s.mates.forEach(function (m, i) {
        P.player(g, m.x, m.y, s.kit, { skin: s.skin, hair: s.hair, dir: -1, frame: Math.floor(s.t * 5 + i) });
      });
      if (s.phase === 'draw' && !s.started) P.dashed(g, s.guide, '#7fe0ff', 4, 0.8);
      else if (s.phase === 'draw') P.dashed(g, s.guide, '#7fe0ff', 4, 0.3);
      if (s.idealEnd && s.phase === 'draw') P.zone(g, s.idealEnd.x, s.idealEnd.y, 9, '#7fe0ff', s.t, true);

      if (!s.ballAnim) P.ball(g, s.ball.x, s.ball.y, 3);
      P.player(g, s.ball.x - 9, s.ball.y + 5, s.kit, { skin: s.skin, hair: s.hair, dir: 1, frame: Math.floor(s.t * 6) });
      if (s.ballAnim) {
        var pt = P.pointAt(s.ballAnim.pts, P.len(s.ballAnim.pts) * (s.ballAnim.t / s.ballAnim.dur));
        P.ball(g, pt.x, pt.y, 3);
      }
      if (s.pts.length > 1) P.trail(g, s.pts, { color: '#ffffff', glow: 'rgba(120,220,255,0.30)', width: 2 });
      s.drawStartHint(g);
    };
    return s;
  };

})(window.BL);
