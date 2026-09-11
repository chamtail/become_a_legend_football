/* ============================================================
 *  match.js — 比赛引擎：出场判定 / 场景调度 / 比分 / 评分
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';
  var U = BL.U, St = BL.State;
  var M = BL.Match = {};

  var ROLE_TEXT = { starter: '首发', sub: '替补登场', bench: '替补席', injured: '因伤缺阵' };

  /* 准备一场比赛 */
  M.prepare = function () {
    var s = St.S, p = s.player;
    var fx = St.playerFixture();
    if (!fx) return null;
    var isHome = fx.home === p.clubId;
    var oppId = isHome ? fx.away : fx.home;
    var opp = St.clubById(oppId);
    var me = St.club();

    var played = false, minutes = 0, role = 'bench', reason = '';
    if (p.weeksOut > 0) {
      role = 'injured';
      reason = p.injuryName + '（还需 ' + p.weeksOut + ' 周）';
    } else {
      var chance = St.starterChance();
      if (Math.random() < chance) { played = true; role = 'starter'; minutes = U.rndInt(68, 90); }
      else if (Math.random() < 0.58) { played = true; role = 'sub'; minutes = U.rndInt(12, 34); reason = '从替补席登场'; }
      else { reason = '本场没有获得出场机会'; }
    }

    /* 场景数量 */
    var n = 0;
    if (played) {
      n = minutes >= 65 ? 4 : minutes >= 35 ? 3 : 2;
      if ((p.relations > 70 || p.reputation > 55) && Math.random() < 0.45) n++;
      if (p.condition < 45) n--;
      if (p.form > 6) n++;
      n = U.clamp(n, 1, 6);
    }
    var types = played ? St.pickSceneTypes(n, opp) : [];

    /* 比分模拟：队友进球 + 对手进球 */
    var myStr = me.str + (isHome ? 3 : 0) + (p.played ? 0 : 0);
    var lam = U.clamp(1.30 + (myStr - opp.str) * 0.055, 0.25, 4.0) * 0.85;
    var lamOpp = U.clamp(1.30 - (myStr - opp.str) * 0.055, 0.25, 4.0);
    var mateGoals = U.poisson(lam), oppGoals = U.poisson(lamOpp);

    var m = {
      opp: opp, me: me, isHome: isHome, played: played, minutes: minutes, role: role,
      reason: reason, minute: 0, gf: 0, ga: 0,
      mateGoals: mateGoals, oppGoals: oppGoals,
      stats: { goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0, dribbles: 0 },
      rating: played ? (role === 'sub' ? 6.0 : 6.2) : 0,
      deltas: [],
      queue: [], timeline: [],
      sceneCounts: {},
      sceneIndex: 0,
      condCost: played ? Math.round(13 + minutes * 0.15) : 3
    };

    /* 生成时间轴 */
    var steps = [];
    var startMin = role === 'sub' ? (90 - minutes) : 1;
    var endMin = role === 'sub' ? 90 : Math.min(90, minutes);
    var i;
    for (i = 0; i < mateGoals; i++) steps.push({ kind: 'goal', side: 'me', minute: U.rndInt(startMin, 90) });
    for (i = 0; i < oppGoals; i++) steps.push({ kind: 'goal', side: 'opp', minute: U.rndInt(1, 90) });
    if (played) {
      var span = Math.max(2, endMin - startMin - 2);
      for (i = 0; i < types.length; i++) {
        var mn = Math.round(startMin + 2 + span * (i + 0.5) / types.length + U.rnd(-3, 3));
        steps.push({ kind: 'scene', type: types[i], minute: U.clamp(mn, 1, 90), index: i });
      }
    }
    steps.sort(function (a, b) { return a.minute - b.minute; });
    m.queue = steps;
    return m;
  };

  /* 推进到某分钟：处理途中的队友/对手进球 */
  M.advanceTo = function (m, minute) {
    while (m.queue.length && m.queue[0].kind === 'goal' && m.queue[0].minute <= minute) {
      var g = m.queue.shift();
      if (g.side === 'me') { m.gf++; m.timeline.push({ minute: g.minute, text: '队友破门 ' + m.me.name + ' 进球', side: 'me' }); }
      else { m.ga++; m.timeline.push({ minute: g.minute, text: m.opp.name + ' 进球', side: 'opp' }); }
    }
    m.minute = Math.max(m.minute, minute);
  };

  M.peek = function (m) { return m.queue.length ? m.queue[0] : null; };

  /* 应用一次场景结果 */
  M.applyScene = function (m, step, res) {
    m.queue.shift();
    var p = St.S.player;
    var c = m.sceneCounts[step.type] = (m.sceneCounts[step.type] || 0) + 1;
    var subF = m.role === 'sub' ? 0.72 : 1;
    var d = 0, txt = '';
    var st = m.stats;
    var q = res.quality;

    if (step.type === 'shoot') {
      st.shots++;
      if (res.outcome === 'goal') { st.goals++; m.gf++; d = q >= 2 ? 1.20 : 0.95; txt = '进球'; }
      else if (res.outcome === 'save') { d = -0.12; txt = '射门被扑'; }
      else { d = -0.32; txt = '射门偏出'; }
    } else if (step.type === 'pass') {
      if (res.outcome === 'assist') { st.assists++; st.keyPasses++; d = 0.80; txt = '助攻'; }
      else if (res.outcome === 'pass') { st.keyPasses++; d = q >= 2 ? 0.38 : 0.22; txt = '传球成功'; }
      else { d = -0.30; txt = '传球失误'; }
    } else if (step.type === 'dribble') {
      if (q >= 1) { st.dribbles++; d = q >= 2 ? 0.48 : 0.26; txt = '突破成功'; }
      else { d = -0.38; txt = '被断球'; }
    } else if (step.type === 'defend') {
      if (q >= 1) { st.tackles++; d = q >= 2 ? 0.50 : 0.30; txt = '抢断成功'; }
      else { d = -0.34; txt = '防守失位'; }
    }
    d *= subF;
    m.rating += d;
    m.deltas.push({ minute: step.minute, text: txt, d: d });
    m.timeline.push({ minute: step.minute, text: (txt || '') + '（' + BL.Scenes.qualityLabel(q) + '）', side: 'me', mine: true });
    if (res.quality >= 1 && step.type === 'shoot') { /* 进球已在台上 */ }
  };

  /* 结算 */
  M.finalize = function (m) {
    M.advanceTo(m, 90);
    var m2 = m;
    if (m2.played) {
      var res = m2.gf > m2.ga ? 1 : m2.gf === m2.ga ? 0 : -1;
      m2.rating += res > 0 ? 0.35 : res === 0 ? 0.05 : -0.30;
      if (m2.stats.goals >= 2) m2.rating += 0.3;
      if (m2.stats.goals + m2.stats.assists >= 3) m2.rating += 0.2;
      m2.rating = U.clamp(m2.rating, 4.0, 10.0);
      m2.rating = U.round1(m2.rating);
    }
    var r = {
      gf: m2.gf, ga: m2.ga,
      result: m2.gf > m2.ga ? 'win' : m2.gf === m2.ga ? 'draw' : 'loss',
      played: m2.played, minutes: m2.minutes, role: m2.role, reason: m2.reason,
      stats: m2.stats, rating: m2.rating, opp: m2.opp, me: m2.me, isHome: m2.isHome,
      sceneCounts: m2.sceneCounts, timeline: m2.timeline, conditionCost: m2.condCost,
      deltas: m2.deltas, motm: m2.rating >= 8.0
    };
    return r;
  };

  /* 快速模拟一个场景（不玩小游戏） */
  M.autoResolve = function (type, opp) {
    var p = St.S.player;
    var keyMap = { shoot: 'shooting', pass: 'passing', dribble: 'dribbling', defend: 'defending' };
    var key = keyMap[type];
    var attr = p.attrs[key];
    var target = opp.str * 0.78 + 14;
    var score = U.clamp(0.5 + (attr - target) * 0.013 + (p.form * 0.008) + U.rnd(-0.17, 0.17), 0.03, 0.97);
    var q = score > 0.70 ? 2 : score > 0.40 ? 1 : 0;
    var txt = '', outcome = '';
    if (type === 'shoot') {
      if (q >= 2) outcome = 'goal';
      else if (q === 1) outcome = Math.random() < 0.45 ? 'goal' : (Math.random() < 0.55 ? 'save' : 'miss');
      else outcome = Math.random() < 0.45 ? 'save' : 'miss';
      txt = outcome === 'goal' ? '球进了！' : outcome === 'save' ? '被门将扑出' : '射偏了';
    } else if (type === 'pass') {
      outcome = q >= 2 ? 'assist' : q === 1 ? 'pass' : 'poor';
      txt = outcome === 'assist' ? '助攻！' : outcome === 'pass' ? '传球成功' : '传球失误';
    } else if (type === 'dribble') {
      outcome = q >= 1 ? 'ok' : 'tackled';
      txt = q >= 1 ? '突破成功' : '球被断了';
    } else {
      outcome = q >= 1 ? 'tackle' : 'beat';
      txt = q >= 1 ? '抢断成功' : '被过掉了';
    }
    return { quality: q, text: txt, outcome: outcome, auto: true };
  };

})(window.BL);
