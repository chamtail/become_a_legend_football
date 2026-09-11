/* ============================================================
 *  ui2.js — 界面：赛前 / 比赛 / 赛后 / 赛季结算 / 退役
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';
  var U = BL.U, St = BL.State, UI = BL.UI;
  var SCENE_NAME = { shoot: '射门', pass: '传球', dribble: '盘带', defend: '防守' };
  var SCENE_ATTR = { shoot: 'shooting', pass: 'passing', dribble: 'dribbling', defend: 'defending' };

  function ratingColor(r) { return r >= 8 ? '#ffe066' : r >= 7 ? '#57cc72' : r >= 6 ? '#dce8f5' : '#ff8080'; }
  function sceneDiff(opp) { return U.clamp((opp.str - 44) / 50, 0.15, 1); }
  function effAttr(k) {
    var p = St.S.player;
    return U.clamp(p.attrs[k] + p.form * 0.7 + (p.condition - 70) * 0.12, 5, 99);
  }

  /* ================= 赛前 ================= */
  UI.screens.prematch = function (params) {
    var s = St.S, p = s.player, club = St.club();
    var fx = St.playerFixture();
    if (!fx) { setTimeout(function () { UI.seasonEnd(); }, 10); return UI.el('<div class="panel">赛季结束</div>'); }
    var isHome = fx.home === p.clubId;
    var opp = St.clubById(isHome ? fx.away : fx.home);
    var chance = St.starterChance();
    UI.setHint('比赛即将开始 —— 在高光时刻用鼠标或手指划出轨迹');

    var h = [];
    h.push('<div class="panel"><div class="panel-title">第 ' + s.week + ' 轮 · 赛前<span class="right">' + BL.TIER_NAME[s.league.tier] + '</span></div>');
    h.push('<div class="spread" style="padding:10px 0">');
    h.push('<div class="team big"><span class="kit" style="background:' + club.kit[0] + '"></span>' + club.name + '</div>');
    h.push('<div class="dim2">VS</div>');
    h.push('<div class="team big"><span class="kit" style="background:' + opp.kit[0] + '"></span>' + opp.name + '</div>');
    h.push('</div>');
    h.push('<div class="center dim2">' + (isHome ? '主场作战' : '客场作战') + ' ｜ 对手实力 ' + opp.str + ' ｜ 我方实力 ' + (club.str + (isHome ? 3 : 0)) + '</div>');
    h.push('</div>');

    h.push('<div class="grid2">');
    h.push('<div class="panel"><div class="panel-title">出场预测</div>');
    if (p.weeksOut > 0) {
      h.push('<div class="red big">因伤缺阵</div><div class="dim2 mt6">' + p.injuryName + '，还需 ' + p.weeksOut + ' 周恢复。</div>');
    } else {
      h.push('<div class="big ' + (chance > 0.7 ? 'green' : chance > 0.45 ? 'yellow' : 'red') + '">' + Math.round(chance * 100) + '%</div>');
      h.push('<div class="dim2">首发概率 ｜ ' + (chance > 0.75 ? '球队主力' : chance > 0.45 ? '轮换阵容' : '边缘球员') + '</div>');
      h.push('<hr class="sep">');
      h.push(UI.miniBar('体力', p.condition, p.condition > 65 ? '#57cc72' : '#f5c542'));
      h.push(UI.miniBar('士气', p.morale, '#4d9de0'));
      h.push(UI.miniBar('队内关系', p.relations, '#a78bfa'));
    }
    h.push('</div>');

    h.push('<div class="panel"><div class="panel-title">对手强度</div>');
    h.push(UI.miniBar('实力', opp.str, '#e05555', 100));
    h.push('<div class="dim2 mt6">对手越强，高光场景越难、越偏向防守，门将反应越快。</div>');
    h.push('<hr class="sep">');
    BL.ATTRS.forEach(function (a) {
      var e = effAttr(a.key);
      var d = e - p.attrs[a.key];
      h.push('<div class="statline"><span class="nm">' + a.name + '</span><div class="bar"><i style="width:' + e + '%;background:' + a.color + '"></i></div><span class="vl" style="color:' + (d < -3 ? '#ff8080' : a.color) + '">' + Math.round(e) + '</span></div>');
    });
    h.push('<div class="dim2 mt6">灰色为体力与状态影响后的实际发挥值。</div>');
    h.push('</div></div>');

    h.push('<div class="panel"><div class="panel-title">比赛方式</div><div class="row">');
    h.push('<button class="btn primary" id="btn-go" style="flex:1;padding:12px">进入球场（亲手操作高光）</button>');
    h.push('<button class="btn" id="btn-auto" style="flex:0 0 auto">快速模拟比赛结果</button>');
    h.push('</div><div class="dim2 mt6">快速模拟会根据能力自动判定所有高光场景，适合想快速推进赛季。</div></div>');

    var node = UI.el(h.join(''));
    node.querySelector('#btn-go').addEventListener('click', function () { UI.startMatch(false); });
    node.querySelector('#btn-auto').addEventListener('click', function () { UI.startMatch(true); });
    return node;
  };

  /* ================= 比赛 ================= */
  UI.startMatch = function (quick) {
    var m = BL.Match.prepare();
    if (!m) { UI.seasonEnd(); return; }
    UI.cur = { name: 'match', params: { m: m, quick: !!quick } };
    UI.render();
  };

  UI.screens.match = function (params) {
    var m = params.m, s = St.S, p = s.player, club = St.club();
    var h = [];
    h.push('<div class="matchwrap">');
    /* 记分牌 */
    h.push('<div class="scoreboard">');
    h.push('<div class="team"><span class="kit" style="background:' + club.kit[0] + '"></span><span>' + UI.esc(club.name) + '</span></div>');
    h.push('<div class="sc" id="sc">0 - 0<small id="minute">第 0 分钟</small></div>');
    h.push('<div class="team away"><span>' + UI.esc(m.opp.name) + '</span><span class="kit" style="background:' + m.opp.kit[0] + '"></span></div>');
    h.push('</div>');
    /* 画布 */
    h.push('<div class="canvas-shell"><canvas class="pitch" id="pitch" width="400" height="248"></canvas>');
    h.push('<div class="scene-hud"><div class="ttl" id="scene-title">准备中</div><div class="tmr" id="scene-attr"></div></div>');
    h.push('</div>');
    h.push('<div class="scene-desc" id="scene-desc">比赛即将开始……</div>');
    h.push('<div class="legend"><span><i style="background:#57cc72"></i>绿=你</span><span><i style="background:#ff8a8a"></i>红=对手抢断范围</span><span><i style="background:#ffe066"></i>黄=目标/提示路线</span><span><i style="background:#7fe0ff"></i>蓝=建议轨迹</span></div>');
    h.push('<div class="timeline" id="timeline"></div>');
    h.push('</div>');

    var node = UI.el(h.join(''));
    UI.setHint('按住球的位置，划出你的轨迹');

    var scEl = node.querySelector('#sc'), minEl = node.querySelector('#minute');
    var tlEl = node.querySelector('#timeline'), descEl = node.querySelector('#scene-desc');
    var titleEl = node.querySelector('#scene-title'), attrEl = node.querySelector('#scene-attr');
    var canvas = node.querySelector('#pitch');

    function board() {
      scEl.innerHTML = m.gf + ' - ' + m.ga + '<small id="minute">第 ' + m.minute + ' 分钟</small>';
      var lines = m.timeline.slice(-40).map(function (t) {
        return '<div><span class="m">' + t.minute + "'</span>" + (t.side === 'opp' ? '<span class="red">' : '<span class="green">') + UI.esc(t.text) + '</span></div>';
      });
      tlEl.innerHTML = lines.join('');
      tlEl.scrollTop = tlEl.scrollHeight;
    }
    board();

    setTimeout(function () { UI.matchStep(m, node, canvas, board, descEl, titleEl, attrEl, params.quick); }, 350);
    return node;
  };

  UI.matchStep = function (m, node, canvas, board, descEl, titleEl, attrEl, quick) {
    if (!node.parentNode) return;                    /* 界面已切换 */
    var step = BL.Match.peek(m);
    if (!step) { UI.finishMatch(m); return; }

    if (step.kind === 'goal') {
      BL.Match.advanceTo(m, step.minute);
      board();
      descEl.innerHTML = step.side === 'me' ? '<b class="green">队友进球！</b> 比分 ' + m.gf + ' - ' + m.ga : '<b class="red">对手进球！</b> 比分 ' + m.gf + ' - ' + m.ga;
      setTimeout(function () { UI.matchStep(m, node, canvas, board, descEl, titleEl, attrEl, quick); }, 850);
      return;
    }

    /* 场景 */
    BL.Match.advanceTo(m, step.minute);
    board();
    var type = step.type;
    var attrKey = SCENE_ATTR[type];
    var diff = sceneDiff(m.opp);
    var res;

    titleEl.textContent = '第 ' + step.minute + "' 高光时刻 · " + SCENE_NAME[type];
    attrEl.textContent = BL.ATTR_MAP[attrKey].name + ' ' + Math.round(effAttr(attrKey)) + ' ｜ 对手 ' + m.opp.str;
    descEl.innerHTML = '【' + SCENE_NAME[type] + '】' + SCENE_DESC[type];

    if (quick) {
      res = BL.Match.autoResolve(type, m.opp);
      BL.Match.applyScene(m, step, res);
      board();
      descEl.innerHTML = '第 ' + step.minute + "' " + SCENE_NAME[type] + '：<b class="' + (res.quality >= 1 ? 'green' : 'red') + '">' + res.text + '</b>';
      setTimeout(function () { UI.matchStep(m, node, canvas, board, descEl, titleEl, attrEl, quick); }, 420);
      return;
    }

    var scene = BL.Scenes.build(type, {
      diff: diff,
      attrs: {
        shooting: effAttr('shooting'), passing: effAttr('passing'), dribbling: effAttr('dribbling'),
        defending: effAttr('defending'), pace: effAttr('pace'), physical: effAttr('physical')
      },
      kit: St.club().kit, oppKit: m.opp.kit,
      skin: (St.S.player.look || {}).skin || '#e8b48a',
      hair: (St.S.player.look || {}).hair || '#2a1d16'
    });
    BL.Run.start(canvas, scene, {
      onMeta: function (s2) { descEl.innerHTML = '【' + s2.title + '】' + SCENE_DESC[type]; },
      onDone: function (res2) {
        if (!node.parentNode) return;
        BL.Match.applyScene(m, step, res2);
        board();
        descEl.innerHTML = '第 ' + step.minute + "' " + SCENE_NAME[type] + '：<b class="' + (res2.quality >= 1 ? 'green' : 'red') + '">' + res2.text + '</b>';
        setTimeout(function () { UI.matchStep(m, node, canvas, board, descEl, titleEl, attrEl, quick); }, 380);
      }
    });
  };

  var SCENE_DESC = {
    shoot: '球到了你的脚下，门前就是机会 —— 从球的位置划出射门轨迹，命中黄色光圈。轨迹越接近提示弧线、终点越准，进球概率越高。',
    pass: '队友正在跑位 —— 划出传球路线，终点落在绿色空档队友的接球点（蓝色圈）上，路线不要从防守球员脚下穿过。',
    dribble: '正面有人拦截 —— 划出你的跑动路线，绕开红色抢断圈，终点落在黄色区域内。',
    defend: '对手带球推进 —— 划出拦截路线，你的轨迹要在他前进的路上截住他（黄色虚线是他接下来的方向）。'
  };

  /* ================= 赛后 ================= */
  UI.finishMatch = function (m) {
    var rep = BL.Match.finalize(m);
    var fx = St.playerFixture();
    if (fx) St.recordResult(fx.home, fx.away, rep.gf, rep.ga);
    rep.growth = St.applyMatch(rep);
    St.save();
    UI.go('postmatch', { rep: rep });
  };

  UI.screens.postmatch = function (params) {
    var rep = params.rep, s = St.S, p = s.player;
    var resText = rep.result === 'win' ? '胜' : rep.result === 'draw' ? '平' : '负';
    var resCol = rep.result === 'win' ? 'green' : rep.result === 'draw' ? 'yellow' : 'red';
    UI.setHint('赛后 —— 数据、评分与成长');
    var h = [];
    h.push('<div class="panel center"><div class="panel-title">全场结束</div>');
    h.push('<div class="big" style="font-size:30px;letter-spacing:6px">' + rep.me.name + ' <span class="' + resCol + '">' + rep.gf + ' - ' + rep.ga + '</span> ' + rep.opp.name + '</div>');
    h.push('<div class="' + resCol + ' big mt6">' + resText + '</div>');
    h.push('</div>');

    h.push('<div class="grid2">');
    h.push('<div class="panel"><div class="panel-title">个人表现</div>');
    if (!rep.played) {
      h.push('<div class="dim">' + (rep.reason || '本场未出场') + '</div>');
    } else {
      h.push('<div class="center"><div style="font-size:40px;font-weight:700;color:' + ratingColor(rep.rating) + ';text-shadow:3px 3px 0 #000">' + rep.rating.toFixed(1) + '</div><div class="dim2">赛后评分' + (rep.motm ? ' · 全场最佳' : '') + '</div></div>');
      h.push('<hr class="sep">');
      h.push('<div class="grid3" style="gap:4px">');
      [['进球', rep.stats.goals], ['助攻', rep.stats.assists], ['射门', rep.stats.shots],
       ['关键传球', rep.stats.keyPasses], ['抢断', rep.stats.tackles], ['过人', rep.stats.dribbles]]
        .forEach(function (kv) {
          h.push('<div class="center"><div class="big yellow">' + kv[1] + '</div><div class="dim2">' + kv[0] + '</div></div>');
        });
      h.push('</div>');
      h.push('<hr class="sep">');
      h.push('<div class="dim2">出场 ' + rep.minutes + ' 分钟 ｜ ' + (rep.role === 'starter' ? '首发' : '替补登场') + '</div>');
      if (rep.deltas && rep.deltas.length) {
        h.push('<hr class="sep"><div class="dim2">高光回顾</div>');
        rep.deltas.forEach(function (d) {
          h.push('<div class="dim2">第' + d.minute + "' " + UI.esc(d.text) + ' <span class="' + (d.d > 0 ? 'green' : 'red') + '">' + (d.d > 0 ? '+' : '') + d.d.toFixed(2) + '</span></div>');
        });
      }
    }
    h.push('</div>');

    h.push('<div class="panel"><div class="panel-title">状态与成长</div>');
    h.push(UI.miniBar('体力', p.condition, p.condition > 65 ? '#57cc72' : p.condition > 35 ? '#f5c542' : '#e05555'));
    h.push(UI.miniBar('士气', p.morale, '#4d9de0'));
    h.push(UI.miniBar('队内关系', p.relations, '#a78bfa'));
    h.push(UI.miniBar('声望', p.reputation, '#f5c542'));
    h.push('<hr class="sep">');
    if (rep.growth && rep.growth.length) {
      h.push('<div class="green">' + rep.growth.join(' ｜ ') + '</div>');
    } else h.push('<div class="dim2">本场没有明显的属性成长。</div>');
    if (p.weeksOut > 0) h.push('<div class="red mt6">伤病：' + p.injuryName + '（缺阵 ' + p.weeksOut + ' 周）</div>');
    h.push('</div></div>');

    var se = s.season;
    var avg = se.ratings ? U.round1(se.ratingSum / se.ratings) : 0;
    h.push('<div class="panel"><div class="panel-title">本赛季累计</div><div class="grid3" style="gap:4px">');
    [['出场', se.apps], ['进球', se.goals], ['助攻', se.assists], ['均分', avg || '-'], ['最佳', se.motm], ['胜/平/负', se.wins + '/' + se.draws + '/' + se.losses]]
      .forEach(function (kv) {
        h.push('<div class="center"><div class="big yellow">' + kv[1] + '</div><div class="dim2">' + kv[0] + '</div></div>');
      });
    h.push('</div></div>');

    h.push('<div class="panel center"><button class="btn primary" id="btn-next" style="padding:11px 30px">继续</button></div>');

    var node = UI.el(h.join(''));
    node.querySelector('#btn-next').addEventListener('click', function () { UI.advanceWeek(); });
    return node;
  };

  /* ================= 推进一周 ================= */
  UI.advanceWeek = function () {
    var s = St.S;
    St.simOtherMatches();
    s.roundIndex++;
    s.week++;
    s.weekDone = false;
    s.weekLog = '';
    St.save();
    if (s.roundIndex >= s.fixtures.length) UI.seasonEnd();
    else UI.go('hub');
  };

  /* ================= 赛季结算 ================= */
  UI.seasonEnd = function () {
    var s = St.S;
    var summary = St.endSeason();
    St.save();
    UI.go('seasonend', { sum: summary });
  };

  UI.screens.seasonend = function (params) {
    var sum = params.sum, s = St.S, p = s.player;
    UI.setHint('赛季结束 —— 荣誉、成长与转会');
    var h = [];
    h.push('<div class="panel center"><div class="panel-title">第 ' + sum.season + ' 赛季 结束</div>');
    h.push('<div class="big" style="font-size:24px;letter-spacing:4px">' + UI.esc(s.player.name) + '</div>');
    h.push('<div class="dim2 mt6">' + sum.age + ' 岁 ｜ ' + sum.club + ' ｜ ' + BL.TIER_NAME[sum.tier] + '</div>');
    h.push('<div class="big mt10">联赛第 <span class="' + (sum.rank <= 3 ? 'green' : 'yellow') + '">' + sum.rank + '</span> 名</div>');
    h.push('</div>');

    h.push('<div class="grid2">');
    h.push('<div class="panel"><div class="panel-title">赛季数据</div><div class="grid3" style="gap:4px">');
    [['出场', sum.apps], ['进球', sum.goals], ['助攻', sum.assists], ['平均分', sum.avg || '-'], ['综合', sum.ovr], ['荣誉', sum.honors.length]]
      .forEach(function (kv) {
        h.push('<div class="center"><div class="big yellow">' + kv[1] + '</div><div class="dim2">' + kv[0] + '</div></div>');
      });
    h.push('</div>');
    h.push('<hr class="sep"><div class="dim2">联赛最佳射手打进 ' + sum.leagueTopGoals + ' 球 ｜ 助攻王 ' + sum.leagueTopAssists + ' 次 ｜ 最高均分 ' + sum.leagueTopRating + '</div>');
    h.push('</div>');

    h.push('<div class="panel"><div class="panel-title">赛季成长</div>');
    h.push('<div class="row">');
    sum.attrLines.forEach(function (a) {
      h.push('<span class="pill ' + (a.d > 0 ? 'g' : 'r') + '">' + a.name + ' ' + (a.d > 0 ? '+' : '') + a.d + '</span>');
    });
    h.push('</div>');
    h.push('<div class="dim2 mt6">综合评分 ' + St.overall() + '（上赛季末 ' + sum.ovr + '）</div>');
    h.push('</div></div>');

    /* 荣誉 */
    h.push('<div class="panel"><div class="panel-title">赛季荣誉</div>');
    if (sum.honors.length) {
      h.push('<div class="row">');
      sum.honors.forEach(function (n) {
        h.push('<span class="pill y" style="font-size:13px;padding:4px 12px">&#127942; ' + n + '</span>');
      });
      h.push('</div>');
    } else h.push('<div class="dim2">本赛季没有获得个人荣誉。</div>');
    if (s.honors.length) {
      h.push('<hr class="sep"><div class="dim2">生涯荣誉室（' + s.honors.length + ' 项）</div><div class="row mt6">');
      var count = {};
      s.honors.forEach(function (x) { count[x.name] = (count[x.name] || 0) + 1; });
      Object.keys(count).forEach(function (k) {
        h.push('<span class="pill">' + k + (count[k] > 1 ? ' ×' + count[k] : '') + '</span>');
      });
      h.push('</div>');
    }
    h.push('</div>');

    /* 转会 */
    var h2 = [];
    if (s.offers && s.offers.length) {
      h2.push('<div class="panel"><div class="panel-title">转会窗口<span class="right">' + s.offers.length + ' 份报价</span></div>');
      h2.push('<div id="offers">');
      s.offers.forEach(function (o, i) {
        h2.push('<div class="cardrow" data-offer="' + i + '"><span class="kit" style="background:' + o.kit[0] + '"></span>' +
          '<div class="t"><b>' + o.name + '</b><small>' + BL.TIER_NAME[o.tier] + ' ｜ 实力 ' + o.str + ' ｜ 周薪 ¥' + o.wage.toLocaleString('en-US') + ' ｜ 转会费 ¥' + o.fee.toLocaleString('en-US') + '</small></div>' +
          '<span class="pill ' + (o.str > St.club().str ? 'g' : 'y') + '">' + (o.str > St.club().str ? '更强' : '相当') + '</span></div>');
      });
      h2.push('</div>');
      h2.push('<div class="btn-col mt6"><button class="btn wide" id="btn-stay">留在 ' + St.club().name + '</button></div>');
      h2.push('<div class="dim2 mt6">点击报价即可加盟。</div></div>');
    } else {
      h2.push('<div class="panel"><div class="panel-title">转会窗口</div><div class="dim2">本赛季没有收到报价。用更好的表现吸引豪门的注意吧。</div>');
      h2.push('<div class="btn-col mt10"><button class="btn primary wide" id="btn-stay">进入下赛季</button></div></div>');
    }
    h.push(h2.join(''));

    var node = UI.el(h.join(''));
    node.querySelector('#btn-stay').addEventListener('click', function () { UI.newSeason(); });
    node.querySelectorAll('[data-offer]').forEach(function (row) {
      row.addEventListener('click', function () {
        var o = s.offers[+row.getAttribute('data-offer')];
        UI.modal({
          title: '确认转会', body: '<p>加盟 <b class="green">' + o.name + '</b>？<br>周薪 ¥' + o.wage.toLocaleString('en-US') + '，' + BL.TIER_NAME[o.tier] + '。' +
            '<br><span class="dim2">加盟更强的球队意味着更激烈的竞争，出场机会可能减少。</span></p>',
          actions: [
            { label: '签约加盟', cls: 'primary', onClick: function () { St.acceptOffer(o); St.save(); UI.toast('你加盟了 ' + o.name + '！', ''); UI.newSeason(); } },
            { label: '再想想', cls: '' }
          ]
        });
      });
    });
    return node;
  };

  UI.newSeason = function () {
    var s = St.S;
    if (s.player.age >= 36) { UI.go('retire'); return; }
    St.startNewSeason();
    St.save();
    UI.go('hub');
  };

  /* ================= 退役 ================= */
  UI.screens.retire = function () {
    var s = St.S, p = s.player;
    UI.setHint('生涯结束 —— 传奇永不落幕');
    var ca = s.career;
    var avg = ca.ratings ? U.round1(ca.ratingSum / ca.ratings) : 0;
    var h = [];
    h.push('<div class="panel center"><div class="panel-title">退役</div>');
    h.push('<div class="big" style="font-size:30px;letter-spacing:8px;color:#57cc72;text-shadow:3px 3px 0 #08240f">传奇落幕</div>');
    h.push('<div class="dim mt10">' + UI.esc(p.name) + ' 在 ' + p.age + ' 岁宣布挂靴。</div>');
    h.push('</div>');
    h.push('<div class="panel"><div class="panel-title">生涯总览</div><div class="grid3" style="gap:4px">');
    [['赛季', ca.seasons], ['出场', ca.apps], ['进球', ca.goals], ['助攻', ca.assists], ['平均分', avg || '-'], ['荣誉', ca.honors.length]]
      .forEach(function (kv) {
        h.push('<div class="center"><div class="big yellow">' + kv[1] + '</div><div class="dim2">' + kv[0] + '</div></div>');
      });
    h.push('</div></div>');

    if (ca.honors.length) {
      h.push('<div class="panel"><div class="panel-title">荣誉室</div><div class="row">');
      var count = {};
      ca.honors.forEach(function (x) { count[x.name] = (count[x.name] || 0) + 1; });
      Object.keys(count).forEach(function (k) {
        h.push('<span class="pill y">' + k + (count[k] > 1 ? ' ×' + count[k] : '') + '</span>');
      });
      h.push('</div></div>');
    }

    h.push('<div class="panel"><div class="panel-title">赛季履历</div>');
    h.push('<table class="tbl"><tr><th>季</th><th>年龄</th><th>俱乐部</th><th>名次</th><th>出场</th><th>进球</th><th>助攻</th><th>均分</th><th>荣誉</th></tr>');
    s.history.forEach(function (x) {
      h.push('<tr><td>' + x.season + '</td><td>' + x.age + '</td><td>' + UI.esc(x.club) + '</td><td>' + x.rank + '</td><td>' + x.apps + '</td><td>' + x.goals + '</td><td>' + x.assists + '</td><td>' + (x.avg || '-') + '</td><td>' + (x.honors.join('、') || '-') + '</td></tr>');
    });
    h.push('</table></div>');
    h.push('<div class="panel center"><button class="btn primary" id="btn-again" style="padding:11px 26px">开始新的生涯</button></div>');
    var node = UI.el(h.join(''));
    node.querySelector('#btn-again').addEventListener('click', function () {
      St.wipe(); UI.go('menu');
    });
    return node;
  };

})(window.BL);
