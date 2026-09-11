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
      canvas.width = P.CW * P.SCALE; canvas.height = P.CH * P.SCALE;
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
      var h = Run.hooks, s = Run.scene;
      /* 关键：补画最后一帧。此时 phase 已是 done，结算横幅不再绘制，
         玩家点完「继续」能立刻看到横幅消失，不会以为没点上而重复点击 */
      if (s) { try { Run.renderOnce(s); } catch (e) {} }
      if (Run.canvas) Run.unbind(Run.canvas);
      Run.scene = null;
      if (h && h.onDone) h.onDone(res, s);
    },

    frame: function (ts) {
      if (!Run.running) return;
      if (!Run.last) Run.last = ts;
      var dt = Math.min(0.05, (ts - Run.last) / 1000);
      Run.last = ts; Run.time += dt;
      var sc = Run.scene;
      if (!sc) return;
      if (sc.update) sc.update(dt, Run.time);
      Run.renderOnce(sc);
      Run.raf = requestAnimationFrame(Run.frame);
    },

    /* 画一帧：世界层与 UI 层都按 SCALE 倍渲染 */
    renderOnce: function (sc) {
      var g = Run.g;
      if (!g || !sc) return;
      var S = P.SCALE;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, P.CW * S, P.CH * S);
      g.setTransform(S, 0, 0, S, -P.VX * S, -P.VY * S);   /* 世界层：倍率 + 视野偏移 */
      if (sc.draw) sc.draw(g, Run.time);
      g.setTransform(S, 0, 0, S, 0, 0);                   /* UI 层：倍率，不偏移 */
      if (sc.drawOverlay) sc.drawOverlay(g, Run.time);
      g.setTransform(1, 0, 0, 1, 0, 0);
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
    /* 立即结束结算横幅（点一下就走，不等下一帧） */
    s.skipResult = function () {
      if (s.phase !== 'result') return;
      var r = s.result;
      s.phase = 'done';
      if (s.api) s.api.done(r);
    };
    s.onDown = function (pt) {
      if (s.phase === 'result') { s.skipResult(); return; }
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
        if (s.resultT >= s.hold) s.skipResult();
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
        P.rect(g, 0, P.CH - 18, P.CW, 11, 'rgba(4,10,14,0.62)');
        P.text(g, s.tip, 4, P.CH - 16, '#e8f2e8', 6.5);
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
      P.text(g, S.qualityLabel(r.quality), P.CW / 2, 28, col, 17, 'center');
      P.text(g, r.text, P.CW / 2, 54, '#ffffff', 9, 'center');
      if (r.detail) P.text(g, r.detail, P.CW / 2, 69, '#b9c9d8', 7, 'center');
      P.text(g, '点击继续', P.CW / 2, P.CH - 17, '#7f93a8', 6.5, 'center');
    };
    s.drawStartHint = function (g) {
      if (s.phase !== 'draw') return;
      if (!s.started && s.ball) {
        P.zone(g, s.ball.x, s.ball.y, 8, '#ffe066', s.t, true);
        P.text(g, '按住这里起手', s.ball.x, s.ball.y - 20, '#ffe066', 6.5, 'center');
      }
      if (s.startWarn > 0) P.text(g, '起手要靠近球！', s.ball.x, s.ball.y - 20, '#ff7b7b', 8, 'center');
    };
    return s;
  };

})(window.BL);
