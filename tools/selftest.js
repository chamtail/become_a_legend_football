/* ============================================================
 *  tools/selftest.js — 无浏览器自检：加载全部游戏脚本，
 *  跑完整生涯 + 随机划轨迹测试所有小游戏，捕获异常。
 *  用法： node tools/selftest.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let errors = [];
function fail(where, e) { errors.push(where + ' -> ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }

/* ---------- 假 canvas 2D 上下文 ---------- */
function fakeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'canvas') return { width: 200, height: 124 };
      if (k in t) return t[k];
      return function () {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
function fakeCanvas() {
  return {
    width: 0, height: 0, style: {},
    getContext: function () { return fakeCtx(); },
    addEventListener: function () {}, removeEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 200, height: 124 }; },
    setPointerCapture: function () {}
  };
}

/* ---------- 极简 DOM ---------- */
function El(tag) {
  this.tag = tag || 'div'; this.children = []; this.style = {}; this._html = '';
  this.width = 0; this.height = 0; this.scrollTop = 0; this.scrollHeight = 0;
  this.parentNode = null; this.disabled = false;
  this.classList = { add() {}, remove() {}, toggle() {} };
  this.dataset = {};
}
El.prototype.addEventListener = function () {};
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
El.prototype.removeChild = function (c) { return c; };
El.prototype.querySelector = function () { return new El('div'); };
El.prototype.querySelectorAll = function () { return []; };
El.prototype.closest = function () { return null; };
El.prototype.getAttribute = function () { return null; };
El.prototype.setAttribute = function () {};
El.prototype.getContext = function () { return fakeCtx(); };
Object.defineProperty(El.prototype, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; } });
Object.defineProperty(El.prototype, 'textContent', { get() { return this._text || ''; }, set(v) { this._text = v; } });

const byId = {};
const sandbox = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, Error, isNaN, parseInt, parseFloat,
  setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; },
  requestAnimationFrame: function () { return 0; }, cancelAnimationFrame: function () {},
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
  location: { hash: '' },
  document: {
    createElement: function (t) { return t === 'canvas' ? Object.assign(new El('canvas'), fakeCanvas()) : new El(t); },
    getElementById: function (id) { if (!byId[id]) byId[id] = new El('div'); return byId[id]; },
    addEventListener: function () {},
    readyState: 'complete'
  },
  addEventListener: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = ['src/data.js', 'src/pixel.js', 'src/state.js', 'src/scenes.js', 'src/scenes2.js', 'src/match.js', 'src/ui.js', 'src/ui2.js', 'src/main.js'];
FILES.forEach(function (f) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
  catch (e) { fail('load ' + f, e); }
});
const BL = sandbox.BL;
if (!BL) { console.error('BL 未定义，加载失败'); process.exit(1); }
const St = BL.State, M = BL.Match, S = BL.Scenes, U = BL.U;

/* ---------- 场景测试：随机划轨迹 ---------- */
const P = BL.Px;
/* 「高手」会划出的轨迹：射门/传球沿理想弧线，盘带绕开抢断圈，防守划向拦截点 */
function goodPath(scene) {
  const ball = scene.ball || { x: 140, y: 80 };
  if (scene.type === 'dribble') {
    const st = scene.me, en = scene.target, pts = [], N = 18;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let x = st.x + (en.x - st.x) * t, y = st.y + (en.y - st.y) * t;
      for (let pass = 0; pass < 4; pass++) {
        scene.defs.forEach(function (d) {
          const dx = x - d.x, dy = y - d.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
          const need = d.tr + 10;
          if (dd < need) { x += dx / dd * (need - dd); y += dy / dd * (need - dd); }
        });
      }
      pts.push({ x: x, y: y });
    }
    return pts;
  }
  if (scene.type === 'defend') {
    const me = scene.me, path = scene.attPath, total = scene.attTotal;
    let best = null;
    for (let s = 0; s <= total; s += 3) {
      const p = P.pointAt(path, s);
      if (P.dist(me, p) / scene.mySpeed <= s / scene.attSpeed + 0.10) { best = p; break; }
    }
    if (!best) best = P.pointAt(path, total);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push({ x: me.x + (best.x - me.x) * t, y: me.y + (best.y - me.y) * t }); }
    return pts;
  }
  if (scene.ideal && scene.ideal.length) return scene.ideal.slice();
  return [{ x: ball.x, y: ball.y }, { x: 224, y: 80 }];
}
function gestureFor(scene, kind) {
  if (kind === 'timeout') return null;
  const base = goodPath(scene);
  if (kind === 'good') return base;
  if (kind === 'short') return base.slice(0, 2).concat([base[1] || base[0]]);
  if (kind === 'straight') {
    const b = base[0], e = base[base.length - 1], pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push({ x: b.x + (e.x - b.x) * t, y: b.y + (e.y - b.y) * t }); }
    return pts;
  }
  /* wild：轨迹乱飘、终点也偏掉 */
  return base.map(function (p, i) {
    const t = i / (base.length - 1 || 1);
    return { x: p.x + Math.sin(t * 11) * 22 + t * 26, y: p.y + Math.cos(t * 9) * 22 + t * 20 };
  });
}

function runScene(type, diff, attrs, kind) {
  const scene = S.build(type, {
    diff: diff, attrs: attrs, kit: ['#3aa655', '#f2f4f8'], oppKit: ['#e05555', '#141a22'],
    skin: '#e8b48a', hair: '#2a1d16'
  });
  let done = null;
  scene.api = { done: function (r) { done = r; }, hint: function () {}, timer: function () {} };
  const g = fakeCtx();
  try {
    scene.init && scene.init(fakeCanvas(), g);
    scene.draw(g, 0); scene.drawOverlay && scene.drawOverlay(g, 0);
    const pts = gestureFor(scene, kind, g);
    if (pts) {
      scene.onDown(pts[0]);
      for (let i = 1; i < pts.length; i++) scene.onMove(pts[i]);
      scene.onUp();
      for (let i = 0; i < 400 && !done; i++) { scene.update(1 / 60); scene.draw(g, i / 60); scene.drawOverlay && scene.drawOverlay(g, i / 60); }
    } else {
      for (let i = 0; i < 400 && !done; i++) { scene.update(1 / 60); scene.draw(g, i / 60); }
    }
  } catch (e) { fail('scene ' + type + '/' + kind + ' diff=' + diff, e); return null; }
  if (!done) fail('scene ' + type + '/' + kind, '未在 6 秒内结算');
  return done;
}

/* ---------- 1. 小游戏全场次测试 ---------- */
const GESTURES = ['good', 'short', 'wild', 'timeout', 'straight'];
let sceneCount = 0, quality = [0, 0, 0];
const byType = {};
['shoot', 'pass', 'dribble', 'defend'].forEach(function (t) { byType[t] = { good: [0, 0], wild: [0, 0], good2: 0, wild2: 0 }; });
[0.2, 0.5, 0.8, 1.0].forEach(function (diff) {
  [25, 45, 65, 88].forEach(function (v) {
    const attrs = { shooting: v, passing: v, dribbling: v, defending: v, pace: v, physical: v };
    ['shoot', 'pass', 'dribble', 'defend'].forEach(function (t) {
      GESTURES.forEach(function (kind) {
        const r = runScene(t, diff, attrs, kind);
        sceneCount++;
        if (r) {
          quality[r.quality]++;
          if (kind === 'good') { byType[t].good[0] += (r.quality >= 1 ? 1 : 0); byType[t].good[1]++; byType[t].good2 += (r.quality >= 2 ? 1 : 0); }
          if (kind === 'wild') { byType[t].wild[0] += (r.quality >= 1 ? 1 : 0); byType[t].wild[1]++; byType[t].wild2 += (r.quality >= 2 ? 1 : 0); }
        }
      });
    });
  });
});

/* ---------- 2. 完整生涯模拟 ---------- */
function careerTest(seedPos, clubId, seasons) {
  St.newGame({ name: '自检员', pos: seedPos, attrs: { shooting: 55, passing: 50, dribbling: 52, defending: 45, pace: 58, physical: 54 }, clubId: clubId });
  const S0 = St.S;
  S0.player.look = { skin: '#e8b48a', hair: '#2a1d16' };
  let matches = 0, goalsTotal = 0;
  for (let season = 1; season <= seasons; season++) {
    while (S0.roundIndex < S0.fixtures.length) {
      /* 每周活动 */
      const actKeys = ['shooting', 'passing', 'dribbling', 'defending', 'pace', 'physical', 'rest', 'social', 'media'];
      const act = actKeys[Math.floor(Math.random() * actKeys.length)];
      try { St.doActivity(act); } catch (e) { fail('doActivity ' + act, e); }
      S0.weekDone = true;
      /* 事件 */
      if (Math.random() < 0.4) {
        const ev = St.rollEvent();
        if (ev) { try { St.applyEvent(ev, Math.floor(Math.random() * ev.options.length)); } catch (e) { fail('applyEvent ' + ev.id, e); } }
      }
      /* 比赛 */
      let m;
      try { m = M.prepare(); } catch (e) { fail('prepare', e); break; }
      if (!m) break;
      let guard = 0;
      while (M.peek(m) && guard++ < 60) {
        const step = M.peek(m);
        if (step.kind === 'goal') { M.advanceTo(m, step.minute); continue; }
        let res;
        try { res = M.autoResolve(step.type, m.opp); M.applyScene(m, step, res); }
        catch (e) { fail('applyScene ' + step.type, e); break; }
      }
      let rep;
      try {
        rep = M.finalize(m);
        const fx = St.playerFixture();
        St.recordResult(fx.home, fx.away, rep.gf, rep.ga);
        St.applyMatch(rep);
      } catch (e) { fail('finalize/applyMatch', e); break; }
      matches++; goalsTotal += rep.stats.goals;
      try {
        St.simOtherMatches();
        S0.roundIndex++; S0.week++;
        S0.weekDone = false;
        if (S0.roundIndex > S0.fixtures.length) { fail('roundIndex 越界', S0.roundIndex); break; }
      } catch (e) { fail('simOtherMatches', e); break; }
    }
    try {
      const sum = St.endSeason();
      if (!sum) fail('endSeason', '无返回值');
      /* 顺便测一下界面渲染 */
      UIrender('seasonend', { sum: sum });
    } catch (e) { fail('endSeason', e); break; }
    try {
      if (S0.offers && S0.offers.length && Math.random() < 0.6) St.acceptOffer(S0.offers[Math.floor(Math.random() * S0.offers.length)]);
      St.startNewSeason();
    } catch (e) { fail('newSeason', e); break; }
  }
  return { matches: matches, goals: goalsTotal, honors: S0.career.honors.length, ovr: St.overall(), age: S0.player.age };
}

/* ---------- 3. 界面渲染冒烟测试 ---------- */
const UI = BL.UI;
function UIrender(name, params) {
  try {
    const fn = UI.screens[name];
    if (!fn) { fail('UI.screens.' + name, '不存在'); return; }
    UI.cur = { name: name, params: params || {} };
    const node = fn(params || {});
    if (!node) fail('UI.screens.' + name, '返回空节点');
  } catch (e) { fail('UI渲染 ' + name, e); }
}

const results = {};
['ST', 'W', 'AM', 'CM', 'DM', 'CB'].forEach(function (pos) {
  const club = BL.CLUBS.filter(function (c) { return c.tier === 3; })[Math.floor(Math.random() * 5)].id;
  results[pos] = careerTest(pos, club, 3);
});

/* 界面冒烟 */
UIrender('menu');
UIrender('create');
if (St.S) {
  St.S.weekDone = false;
  UIrender('hub');
  UIrender('prematch');
  UIrender('postmatch', { rep: { gf: 2, ga: 1, result: 'win', played: true, minutes: 90, role: 'starter', stats: { goals: 1, assists: 1, shots: 2, keyPasses: 2, tackles: 1, dribbles: 3 }, rating: 7.8, opp: St.clubById('schalk'), me: St.club(), isHome: true, sceneCounts: {}, timeline: [], conditionCost: 20, deltas: [{ minute: 12, text: '进球', d: 1.2 }], growth: ['射门 +0.3'], motm: false } });
  UIrender('devscene', { type: 'shoot' });
  UIrender('retire');
}

/* ---------- 输出 ---------- */
console.log('=== 小游戏 ===');
console.log('场景结算次数: ' + sceneCount + '  失败 ' + quality[0] + ' / 成功 ' + quality[1] + ' / 精彩 ' + quality[2]);
console.log('场景      认真划 成功/精彩      乱划 成功/精彩');
['shoot', 'pass', 'dribble', 'defend'].forEach(function (t) {
  const b = byType[t];
  console.log('  ' + t.padEnd(8) + (b.good[0] / b.good[1] * 100).toFixed(0) + '% / ' + (b.good2 / b.good[1] * 100).toFixed(0) + '%' +
    '            ' + (b.wild[0] / b.wild[1] * 100).toFixed(0) + '% / ' + (b.wild2 / b.wild[1] * 100).toFixed(0) + '%');
});
console.log('=== 生涯模拟（每个位置 3 个赛季） ===');
Object.keys(results).forEach(function (k) {
  const r = results[k];
  console.log('  ' + k + ': 出场 ' + r.matches + ' 进球 ' + r.goals + ' 荣誉 ' + r.honors + ' 综评 ' + r.ovr + ' 年龄 ' + r.age);
});
console.log('=== 错误 ===');
if (!errors.length) console.log('无 ✅');
else errors.slice(0, 25).forEach(function (e, i) { console.log((i + 1) + '. ' + e); });
console.log('错误总数: ' + errors.length);
process.exit(errors.length ? 1 : 0);
