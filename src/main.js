/* ============================================================
 *  main.js — 启动入口（含 #dev= 调试模式，便于快速预览各个界面）
 * ============================================================ */
(function (BL) {
  'use strict';
  var UI = BL.UI, St = BL.State, U = BL.U;

  /* 调试：单场景预览 */
  UI.screens.devscene = function (params) {
    var h = ['<div class="panel"><div class="panel-title">场景调试 · ' + params.type + '<span class="right">#dev=' + params.type + '</span></div>'];
    h.push('<div class="canvas-shell"><canvas class="pitch" id="pitch" width="200" height="124"></canvas></div>');
    h.push('<div class="scene-desc" id="scene-desc">划出轨迹试试看</div></div>');
    h.push('<div class="panel"><div class="panel-title">参数</div><div class="row">' +
      [['shoot', '射门'], ['pass', '传球'], ['dribble', '盘带'], ['defend', '防守']].map(function (t) {
        return '<button class="btn sm" data-t="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="dim2 mt6">难度由对手实力决定，能力值影响容错圈与划动时间。</div></div>');
    var node = UI.el(h.join(''));
    node.querySelector('.row').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-t]') : null;
      if (!b) return;
      UI.go('devscene', { type: b.getAttribute('data-t') });
    });
    setTimeout(function () {
      var cv = node.querySelector('#pitch');
      if (!cv) return;
      var p = St.S.player;
      var type = params.type === 'scene' ? U.pick(['shoot', 'pass', 'dribble', 'defend']) : params.type;
      var sc = BL.Scenes.build(type, {
        diff: params.diff === undefined ? 0.6 : params.diff,
        attrs: p.attrs, kit: St.club().kit, oppKit: ['#e05555', '#141a22'],
        skin: (p.look || {}).skin || '#e8b48a', hair: (p.look || {}).hair || '#2a1d16'
      });
      BL.Run.start(cv, sc, {
        onMeta: function (s2) { var d = node.querySelector('#scene-desc'); if (d) d.textContent = '【' + s2.title + '】时间限制 ' + s2.timeLimit.toFixed(1) + ' 秒'; },
        onDone: function (res) {
          var d = node.querySelector('#scene-desc');
          if (d) d.innerHTML = '结果：<b class="' + (res.quality >= 1 ? 'green' : 'red') + '">' + res.text + '</b>　' + (res.detail || '');
          setTimeout(function () { if (node.parentNode) UI.go('devscene', { type: type, diff: params.diff }); }, 1800);
        }
      });
    }, 60);
    return node;
  };

  function boot() {
    var hash = (location.hash || '').replace('#', '');
    var dev = null;
    hash.split('&').forEach(function (kv) {
      if (kv.indexOf('dev=') === 0) dev = kv.slice(4);
    });

    if (dev) {
      /* 调试模式：构造一个测试球员，但不写入存档 */
      St.newGame({ name: '测试球员', pos: 'ST', attrs: { shooting: 72, passing: 66, dribbling: 70, defending: 58, pace: 74, physical: 68 }, clubId: 'gron' });
      St.S.player.look = { skin: '#e8b48a', hair: '#2a1d16' };
      St.S.weekDone = false;
      St.save = function () {};
      if (dev === 'hub' || dev === 'menu' || dev === 'create' || dev === 'prematch' || dev === 'seasonend' || dev === 'retire') {
        UI.go(dev);
      } else if (dev === 'postmatch') {
        UI.go('postmatch', { rep: { gf: 3, ga: 1, result: 'win', played: true, minutes: 90, role: 'starter', stats: { goals: 2, assists: 1, shots: 3, keyPasses: 2, tackles: 1, dribbles: 4 }, rating: 8.7, opp: St.clubById('schalk'), me: St.club(), isHome: true, sceneCounts: {}, timeline: [], conditionCost: 20, deltas: [{ minute: 12, text: '进球', d: 1.2 }, { minute: 44, text: '助攻', d: 0.8 }], growth: ['射门 +0.3', '速度 +0.2'], motm: true } });
      } else if (dev === 'match') {
        UI.go('prematch');
      } else if (dev === 'play') {
        UI.go('hub');
        setTimeout(function () { UI.startMatch(false); }, 30);
      } else {
        UI.go('devscene', { type: dev });
      }
      return;
    }

    UI.screenEl = document.getElementById('screen');
    UI.go('menu');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('hashchange', function () { location.reload(); });
})(window.BL);
