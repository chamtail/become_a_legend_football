/* ============================================================
 *  pixel.js — 像素渲染：球场 / 球员 / 足球 / 轨迹 / 头像
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';

  var P = BL.Px = {};
  P.W = 256; P.H = 160;              /* 世界坐标尺寸 */
  P.VX = 56; P.VY = 18;               /* 视野偏移：镜头对准右侧进攻区域 */
  P.CW = P.W - P.VX; P.CH = P.H - P.VY * 2;   /* 视野尺寸（UI 单位）200 x 124 */
  P.SCALE = 2;                                 /* 画布像素 = 单位 x SCALE，画布 400 x 248 */
  P.LINE = 246;                       /* 底线 x */
  P.GOAL_TOP = 55; P.GOAL_BOT = 105;  /* 球门上下沿 */
  P.CX = 210; P.CY = 80;              /* 禁区弧顶附近 */

  P.COL = {
    grassA: '#2f8a45', grassB: '#2a7d3e', grassC: '#256f37',
    line: '#e8f2e8', dark: '#0d1a12', ball: '#f7f7f2',
    shadow: 'rgba(0,0,0,0.25)', net: '#cfe6d4'
  };

  /* 对齐到画布像素网格：SCALE=2 时半个单位正好一个画布像素，
     这样既能用 0.5 单位画细节，又不会出现半像素导致的模糊 */
  P.snap = function (v) { return Math.round(v * P.SCALE) / P.SCALE; };
  P.rect = function (g, x, y, w, h, c) {
    g.fillStyle = c;
    var sx = P.snap(x), sy = P.snap(y);
    var ex = P.snap(x + w), ey = P.snap(y + h);
    var min = 1 / P.SCALE;
    g.fillRect(sx, sy, Math.max(min, ex - sx), Math.max(min, ey - sy));
  };

  /* ---------------- 球场（进攻向右的禁区前沿视角） ---------------- */
  P.pitch = function (g, opt) {
    opt = opt || {};
    var i, T = 0.5;                 /* 细线 = 半个单位 = 1 个画布像素 */
    /* 草地条纹 */
    for (i = 0; i < P.W; i += 16) {
      P.rect(g, i, 0, 16, P.H, ((i / 16) % 2 === 0) ? P.COL.grassA : P.COL.grassB);
    }
    /* 割草横纹，让大片草地不至于是一块死绿 */
    for (i = 4; i < P.H; i += 8) P.rect(g, 0, i, P.W, 0.5, 'rgba(255,255,255,0.030)');
    for (i = 8; i < P.H; i += 16) P.rect(g, 0, i, P.W, 0.5, 'rgba(0,0,0,0.055)');
    /* 上下压暗营造纵深，左缘渐暗 */
    P.rect(g, 0, 0, P.W, 7, 'rgba(0,0,0,0.13)');
    P.rect(g, 0, P.H - 7, P.W, 7, 'rgba(0,0,0,0.13)');
    for (i = 0; i < 12; i++) P.rect(g, i, 0, 1, P.H, 'rgba(0,0,0,0.026)');

    /* 边线 / 底线 */
    P.rect(g, 0, 3, P.LINE, T, P.COL.line);
    P.rect(g, 0, P.H - 4, P.LINE, T, P.COL.line);
    P.rect(g, P.LINE, 3, T, P.H - 7, P.COL.line);
    /* 底线外的深色区域 */
    P.rect(g, P.LINE + T, 0, P.W - P.LINE - T, P.H, P.COL.dark);
    /* 球网：网眼加密一倍 */
    for (i = P.GOAL_TOP; i <= P.GOAL_BOT; i += 1.5) P.rect(g, P.LINE + 1.5, i, P.W - P.LINE - 1.5, 0.5, '#263d2c');
    for (i = P.LINE + 3; i < P.W; i += 1.5) P.rect(g, i, P.GOAL_TOP, 0.5, P.GOAL_BOT - P.GOAL_TOP, '#263d2c');
    /* 门柱与横梁 */
    P.rect(g, P.LINE, P.GOAL_TOP - 2.5, 1.5, 2.5, '#ffffff');
    P.rect(g, P.LINE, P.GOAL_BOT, 1.5, 2.5, '#ffffff');
    P.rect(g, P.LINE, P.GOAL_TOP - 2.5, 1, P.GOAL_BOT - P.GOAL_TOP + 5, '#f4f8f4');
    /* 球门区 6 码 */
    P.rect(g, 224, 47, 22, T, P.COL.line); P.rect(g, 224, 112, 22, T, P.COL.line);
    P.rect(g, 224, 47, T, 65.5, P.COL.line);
    /* 禁区 */
    P.rect(g, 196, 26, 50, T, P.COL.line); P.rect(g, 196, 133, 50, T, P.COL.line);
    P.rect(g, 196, 26, T, 107.5, P.COL.line);
    /* 点球点 */
    P.rect(g, 208, 79.5, 1.5, 1.5, P.COL.line);
    /* 禁区弧 */
    for (i = -34; i <= 34; i += 2) {
      var rad = i * Math.PI / 180;
      var px = 208 + Math.cos(rad) * 26, py = 80 + Math.sin(rad) * 26;
      if (px < 196) P.rect(g, px, py, T, T, P.COL.line);
    }
  };

  /* ---------------- 顶视球员 ---------------- */
  var SKIN = ['#e8b48a', '#c98d5e', '#8d5a34', '#5c3a20', '#f0c9a0'];
  P.skinOf = function (seed) { return SKIN[Math.abs(seed | 0) % SKIN.length]; };

  P.player = function (g, x, y, kit, o) {
    o = o || {};
    x = P.snap(x); y = P.snap(y);
    var skin = o.skin || '#e8b48a';
    var hair = o.hair || '#2a1d16';
    var shirt = o.shirt || (kit ? kit[0] : '#3aa655');
    var shorts = o.shorts || (kit ? kit[1] : '#f2f4f8');
    var sock = o.sock || shirt;
    var f = o.frame || 0;
    var dir = o.dir || 1;
    var shirtD = P.shade(shirt, -0.26), shirtL = P.shade(shirt, 0.18);
    var shortD = P.shade(shorts, -0.28);

    /* 影子 */
    g.fillStyle = P.COL.shadow;
    g.beginPath(); g.ellipse(x + 0.5, y + 3.5, 6.5, 3.0, 0, 0, Math.PI * 2); g.fill();

    /* 双腿（跑动时前后错开）：短裤 → 球袜 → 球鞋 */
    var l1 = (f % 2 === 0) ? 0.5 : -0.5;
    P.rect(g, x - 4, y + 1.5 + l1, 3, 3.5, shorts);
    P.rect(g, x + 1, y + 1.5 - l1, 3, 3.5, shorts);
    P.rect(g, x - 4, y + 4.5 + l1, 3, 3, sock);
    P.rect(g, x + 1, y + 4.5 - l1, 3, 3, sock);
    P.rect(g, x - 4, y + 4.5 + l1, 3, 0.5, P.shade(sock, -0.2));
    P.rect(g, x + 1, y + 4.5 - l1, 3, 0.5, P.shade(sock, -0.2));
    P.rect(g, x - 4.5, y + 7.5 + l1, 4, 1.5, '#20242a');
    P.rect(g, x + 1, y + 7.5 - l1, 4, 1.5, '#20242a');

    /* 短裤 */
    P.rect(g, x - 5, y - 0.5, 10.5, 2.5, shorts);
    P.rect(g, x - 5, y - 0.5, 10.5, 0.5, shortD);

    /* 躯干 / 肩膀 */
    P.rect(g, x - 5, y - 5.5, 10.5, 5.5, shirt);
    P.rect(g, x - 5, y - 5.5, 10.5, 1, shirtL);              /* 肩线高光 */
    P.rect(g, x - 5, y - 5.5, 0.5, 5.5, shirtD);             /* 左侧暗部 */
    P.rect(g, x + 5, y - 5.5, 0.5, 5.5, shirtD);             /* 右侧暗部 */
    /* 手臂：袖子 + 前臂 */
    P.rect(g, x - 7, y - 5 + l1, 2, 2.5, shirt);
    P.rect(g, x + 6, y - 5 - l1, 2, 2.5, shirt);
    P.rect(g, x - 7, y - 2.5 + l1, 2, 3, skin);
    P.rect(g, x + 6, y - 2.5 - l1, 2, 3, skin);
    /* 背号 */
    if (o.number !== undefined && o.number !== null && o.showNumber !== false) {
      P.rect(g, x - 1.5, y - 4.5, 3, 3.5, P.shade(shirt, 0.5));
      P.rect(g, x - 1, y - 4, 2, 2.5, P.shade(shirt, -0.42));
    }
    /* 头（顶视主要看到头发）＋ 面部 */
    P.rect(g, x - 3.5, y - 5, 7.5, 7, hair);
    P.rect(g, x - 3.5, y - 5, 7.5, 1, P.shade(hair, 0.26));  /* 头发高光 */
    P.rect(g, x - 3.5, y + 1.5, 7.5, 0.5, P.shade(hair, -0.35));
    P.rect(g, x - 3.5 + (dir > 0 ? 5.5 : 0), y - 3.5, 2, 4.5, skin);
    /* 标记 */
    if (o.marker) {
      g.fillStyle = o.marker;
      g.beginPath();
      g.moveTo(x, y - 12); g.lineTo(x - 4, y - 18); g.lineTo(x + 4, y - 18);
      g.closePath(); g.fill();
      P.rect(g, x - 4, y - 19, 9, 2, o.marker);
    }
    if (o.ring) {
      g.strokeStyle = o.ring; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y + 2, o.ringR || 9, 0, Math.PI * 2); g.stroke();
    }
  };

  P.shade = function (hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16), gg = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = Math.max(0, Math.min(255, Math.round(r + 255 * amt)));
    gg = Math.max(0, Math.min(255, Math.round(gg + 255 * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + 255 * amt)));
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  };

  /* ---------------- 足球 ---------------- */
  P.ball = function (g, x, y, r) {
    r = r || 3;
    g.fillStyle = P.COL.shadow;
    g.beginPath(); g.ellipse(x + 1, y + r * 0.9, r * 1.15, r * 0.5, 0, 0, Math.PI * 2); g.fill();
    /* 描边 + 球体 */
    g.fillStyle = '#20262b';
    g.beginPath(); g.arc(x, y, r + 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = P.COL.ball;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    /* 受光面高光 */
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(x - r * 0.32, y - r * 0.36, r * 0.40, 0, Math.PI * 2); g.fill();
    /* 黑色皮块：中心一块 + 四周四块（半个单位 = 1 个画布像素） */
    P.rect(g, x - 0.5, y - 0.5, 1.5, 1.5, '#1e1e1e');
    P.rect(g, x - r * 0.9, y + r * 0.15, 1, 1, '#2b2b2b');
    P.rect(g, x + r * 0.3, y - r * 0.85, 1, 1, '#2b2b2b');
    P.rect(g, x + r * 0.15, y + r * 0.6, 1, 1, '#2b2b2b');
    P.rect(g, x - r * 0.35, y + r * 0.75, 0.5, 0.5, '#333');
  };

  /* ---------------- 轨迹 ---------------- */
  P.trail = function (g, pts, o) {
    if (!pts || pts.length < 2) return;
    o = o || {};
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = o.glow || 'rgba(255,255,255,0.18)';
    g.lineWidth = (o.width || 3) + 3;
    P.strokePath(g, pts);
    g.strokeStyle = o.color || '#ffffff';
    g.lineWidth = o.width || 3;
    P.strokePath(g, pts);
    if (o.dots) {
      for (var i = 0; i < pts.length; i += 6) P.rect(g, pts[i].x - 1, pts[i].y - 1, 2, 2, o.dotColor || '#ffe066');
    }
    var last = pts[pts.length - 1];
    P.rect(g, last.x - 2, last.y - 2, 4, 4, o.color || '#ffffff');
  };

  P.strokePath = function (g, pts) {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  };

  /* 虚线提示路径 */
  P.dashed = function (g, pts, color, dash, alpha) {
    if (!pts || pts.length < 2) return;
    g.save();
    g.globalAlpha = alpha === undefined ? 0.75 : alpha;
    g.strokeStyle = color; g.lineWidth = 1.5;
    if (g.setLineDash) g.setLineDash([dash || 4, 4]);
    P.strokePath(g, pts);
    if (g.setLineDash) g.setLineDash([]);
    g.restore();
  };

  /* 目标圈 */
  P.zone = function (g, x, y, r, color, t, pulse) {
    g.save();
    g.strokeStyle = color; g.lineWidth = 2;
    var rr = r + (pulse ? Math.sin((t || 0) * 6) * 1.6 : 0);
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.22;
    g.fillStyle = color; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.9;
    P.rect(g, x - 1, y - 6, 2, 12, color);
    P.rect(g, x - 6, y - 1, 12, 2, color);
    g.restore();
  };

  /* 参数曲线采样：二次贝塞尔 */
  P.quad = function (p0, p1, p2, n) {
    var out = [], i, t;
    n = n || 24;
    for (i = 0; i <= n; i++) {
      t = i / n;
      var mt = 1 - t;
      out.push({
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
      });
    }
    return out;
  };

  P.dist = function (a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); };
  P.len = function (pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += P.dist(pts[i - 1], pts[i]); return s; };

  /* 点到折线的最短距离 */
  P.distToPath = function (pt, pts) {
    var best = 1e9;
    for (var i = 1; i < pts.length; i++) {
      var d = P.distToSeg(pt, pts[i - 1], pts[i]);
      if (d < best) best = d;
    }
    if (pts.length === 1) best = P.dist(pt, pts[0]);
    return best;
  };
  P.distToSeg = function (p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y;
    var wx = p.x - a.x, wy = p.y - a.y;
    var L2 = vx * vx + vy * vy;
    var t = L2 > 0 ? (wx * vx + wy * vy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var dx = p.x - (a.x + t * vx), dy = p.y - (a.y + t * vy);
    return Math.sqrt(dx * dx + dy * dy);
  };

  /* 沿路径按弧长取点 */
  P.pointAt = function (pts, s) {
    var acc = 0, i;
    for (i = 1; i < pts.length; i++) {
      var d = P.dist(pts[i - 1], pts[i]);
      if (acc + d >= s) {
        var t = d > 0 ? (s - acc) / d : 0;
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
      }
      acc += d;
    }
    return pts[pts.length - 1];
  };

  /* 重采样为等距点 */
  P.resample = function (pts, step) {
    if (!pts.length) return [];
    step = step || 4;
    var total = P.len(pts), n = Math.max(2, Math.round(total / step)), out = [], i;
    for (i = 0; i <= n; i++) out.push(P.pointAt(pts, total * i / n));
    return out;
  };

  /* 平滑（去掉抖动） */
  P.smooth = function (pts, passes) {
    passes = passes || 1;
    var out = pts;
    for (var p = 0; p < passes; p++) {
      var nx = [out[0]];
      for (var i = 1; i < out.length - 1; i++) {
        nx.push({ x: (out[i - 1].x + out[i].x * 2 + out[i + 1].x) / 4, y: (out[i - 1].y + out[i].y * 2 + out[i + 1].y) / 4 });
      }
      nx.push(out[out.length - 1]);
      out = nx;
    }
    return out;
  };

  /* ---------------- 文本 ---------------- */
  P.text = function (g, str, x, y, color, size, align, shadow) {
    g.font = 'bold ' + (size || 8) + 'px ui-monospace, Consolas, "Microsoft YaHei", monospace';
    g.textAlign = align || 'left';
    g.textBaseline = 'top';
    if (shadow !== false) { g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillText(str, x + 1, y + 1); }
    g.fillStyle = color || '#ffffff';
    g.fillText(str, x, y);
    g.textAlign = 'left';
  };

  /* ---------------- 头像（像素脸） ---------------- */
  P.avatar = function (cv, opt) {
    var g = cv.getContext('2d');
    var S = 32;
    cv.width = S; cv.height = S;
    g.imageSmoothingEnabled = false;
    opt = opt || {};
    var skin = opt.skin || '#e8b48a', hair = opt.hair || '#2a1d16', kit = opt.kit || ['#3aa655', '#f2f4f8'];
    P.rect(g, 0, 0, S, S, '#101820');
    P.rect(g, 0, 0, S, S, '#16202b');
    /* 背景斜纹 */
    for (var i = -S; i < S; i += 6) P.rect(g, i, 0, 2, S, '#1b2836');
    /* 肩膀 */
    P.rect(g, 4, 24, 24, 8, kit[0]);
    P.rect(g, 4, 24, 24, 2, P.shade(kit[0], -0.2));
    P.rect(g, 4, 28, 24, 4, kit[1]);
    /* 脖子 */
    P.rect(g, 13, 21, 6, 4, P.shade(skin, -0.15));
    /* 头 */
    P.rect(g, 8, 6, 16, 16, skin);
    P.rect(g, 7, 9, 18, 11, skin);
    /* 头发 */
    P.rect(g, 7, 4, 18, 6, hair);
    P.rect(g, 7, 4, 4, 12, hair);
    P.rect(g, 21, 4, 4, 10, hair);
    P.rect(g, 10, 10, 3, 2, hair);
    /* 眼睛 */
    P.rect(g, 11, 13, 3, 3, '#ffffff'); P.rect(g, 12, 14, 2, 2, '#20242c');
    P.rect(g, 18, 13, 3, 3, '#ffffff'); P.rect(g, 19, 14, 2, 2, '#20242c');
    /* 眉毛 / 嘴 */
    P.rect(g, 11, 11, 3, 1, P.shade(hair, 0.05));
    P.rect(g, 18, 11, 3, 1, P.shade(hair, 0.05));
    P.rect(g, 14, 19, 4, 1, '#a5644f');
    /* 腮红 */
    P.rect(g, 9, 17, 2, 2, 'rgba(200,90,80,0.35)');
    P.rect(g, 21, 17, 2, 2, 'rgba(200,90,80,0.35)');
  };

})(window.BL);
