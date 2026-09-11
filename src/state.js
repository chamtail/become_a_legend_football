/* ============================================================
 *  state.js — 游戏状态、成长、联赛、赛季、荣誉、转会、存档
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';

  /* ---------------- 工具 ---------------- */
  var U = BL.U = {
    rnd: function (a, b) { return a + Math.random() * (b - a); },
    rndInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    round1: function (v) { return Math.round(v * 10) / 10; },
    poisson: function (lambda) {
      var L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L && k < 12);
      return k - 1;
    },
    shuffle: function (a) {
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
  };

  /* 存档 key：GitHub Pages 上同一用户的多个项目共享 user.github.io 这个 origin，
     因此用部署路径做后缀隔离，避免不同项目互相覆盖存档。
     本地 file:// 打开时保持原始 key，移动文件夹不会丢档。 */
  var SAVE_KEY = (function () {
    var base = 'bl_save_v1';
    try {
      if (typeof location !== 'undefined' && location.pathname &&
          (location.protocol === 'http:' || location.protocol === 'https:')) {
        var seg = location.pathname.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
        if (seg) base += ':' + seg;
      }
    } catch (err) { /* ignore */ }
    return base;
  })();

  var St = BL.State = {
    S: null,
    /* ---------------- 新建 ---------------- */
    newGame: function (opts) {
      var attrs = {};
      BL.ATTRS.forEach(function (a) { attrs[a.key] = 30; });
      var base = opts.attrs || {};
      BL.ATTRS.forEach(function (a) { attrs[a.key] = U.clamp(base[a.key] || 30, 20, 60); });

      var club = BL.CLUB_MAP[opts.clubId] || BL.CLUB_MAP['ostra'];
      var s = {
        version: 1,
        player: {
          name: opts.name || '无名氏',
          pos: opts.pos || 'ST',
          age: 17,
          attrs: attrs,
          condition: 100, morale: 65, relations: 45, reputation: 3, form: 0,
          money: 20000, wage: Math.round(club.wage * 0.25),
          clubId: club.id,
          weeksOut: 0, injuryName: '',
          upgrades: {}
        },
        seasonNo: 1,
        week: 1,
        season: St.emptySeason(),
        career: { apps: 0, goals: 0, assists: 0, ratingSum: 0, ratings: 0, honors: [], seasons: 0 },
        honors: [],
        history: [],
        log: [],
        league: null,
        fixtures: null,
        roundIndex: 0,
        offers: null,
        pendingSeasonEnd: false,
        retired: false,
        createdAt: Date.now()
      };
      St.S = s;
      St.makeLeague();
      St.save();
      return s;
    },

    emptySeason: function () {
      return { apps: 0, subs: 0, goals: 0, assists: 0, ratingSum: 0, ratings: 0,
               motm: 0, mins: 0, shots: 0, keyPasses: 0, tackles: 0, dribbles: 0, wins: 0, draws: 0, losses: 0 };
    },

    /* ---------------- 基本取值 ---------------- */
    player: function () { return St.S.player; },
    club: function () { return St.clubById(St.S.player.clubId); },
    clubById: function (id) {
      if (BL.CLUB_MAP[id]) return BL.CLUB_MAP[id];
      var t = St.S.league && St.S.league.teams;
      if (t) for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i];
      return { id: id, name: id, str: 60, fac: 2, wage: 10000, kit: ['#888', '#333'], tier: 1 };
    },
    overall: function () {
      var p = St.S.player, w = BL.POSITIONS[p.pos].ovr, sum = 0;
      for (var k in w) sum += p.attrs[k] * w[k];
      return Math.round(sum);
    },

    /* ---------------- 联赛 ---------------- */
    makeLeague: function () {
      var club = St.club();
      var tier = club.tier || 3;
      var named = BL.CLUBS.filter(function (c) { return c.tier === tier; });
      var teams = named.map(function (c) {
        return { id: c.id, name: c.name, str: c.str, kit: c.kit, tier: tier, isPlayer: c.id === club.id, fac: c.fac, wage: c.wage };
      });
      if (!teams.some(function (t) { return t.isPlayer; })) {
        teams.push({ id: club.id, name: club.name, str: club.str, kit: club.kit, tier: tier, isPlayer: true, fac: club.fac || 2, wage: club.wage || 10000 });
      }
      var names = U.shuffle(BL.FILLER_NAMES.slice());
      var kits = U.shuffle(BL.FILLER_KITS.slice());
      var base = BL.TIER_BASE[tier] || 60;
      var i = 0;
      while (teams.length < 10) {
        var nm = names[i % names.length] + (i >= names.length ? '二队' : '');
        teams.push({
          id: 'f' + tier + '_' + i, name: nm,
          str: U.clamp(Math.round(base + U.rnd(-6, 6)), 40, 92),
          kit: kits[i % kits.length], tier: tier, isPlayer: false, fac: U.rndInt(1, 3), wage: 10000
        });
        i++;
      }
      St.S.league = { tier: tier, teams: teams, table: {} };
      teams.forEach(function (t) {
        St.S.league.table[t.id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      });
      St.S.fixtures = St.buildFixtures(teams.map(function (t) { return t.id; }));
      St.S.roundIndex = 0;
    },

    buildFixtures: function (ids) {
      var arr = ids.slice(), n = arr.length, first = [];
      for (var r = 0; r < n - 1; r++) {
        var pairs = [];
        for (var i = 0; i < n / 2; i++) {
          var a = arr[i], b = arr[n - 1 - i];
          pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
        }
        first.push(pairs);
        arr.splice(1, 0, arr.pop());
      }
      var second = first.map(function (rd) {
        return rd.map(function (m) { return { home: m.away, away: m.home }; });
      });
      return first.concat(second);
    },

    playerFixture: function () {
      var idx = St.S.roundIndex;
      if (idx >= St.S.fixtures.length) return null;
      var pid = St.S.player.clubId;
      var rd = St.S.fixtures[idx];
      for (var i = 0; i < rd.length; i++) if (rd[i].home === pid || rd[i].away === pid) return rd[i];
      return null;
    },

    simOtherMatches: function () {
      var idx = St.S.roundIndex, pid = St.S.player.clubId;
      if (idx >= St.S.fixtures.length) return;
      St.S.fixtures[idx].forEach(function (m) {
        if (m.home === pid || m.away === pid) return;
        var h = St.clubById(m.home), a = St.clubById(m.away);
        var homeAdv = 3;
        var g = St.simScore(h.str + homeAdv, a.str);
        St.recordResult(m.home, m.away, g[0], g[1]);
      });
    },

    simScore: function (sa, sb) {
      var d = sa - sb;
      var la = U.clamp(1.30 + d * 0.055, 0.22, 4.2);
      var lb = U.clamp(1.30 - d * 0.055, 0.22, 4.2);
      return [U.poisson(la), U.poisson(lb)];
    },

    recordResult: function (homeId, awayId, gh, ga) {
      var t = St.S.league.table;
      var H = t[homeId], A = t[awayId];
      if (!H || !A) return;
      H.p++; A.p++; H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
      if (gh > ga) { H.w++; A.l++; H.pts += 3; }
      else if (gh < ga) { A.w++; H.l++; A.pts += 3; }
      else { H.d++; A.d++; H.pts++; A.pts++; }
    },

    tableSorted: function () {
      var t = St.S.league.table;
      var arr = Object.keys(t).map(function (id) {
        var r = t[id], c = St.clubById(id);
        return { id: id, name: c.name, kit: c.kit, isPlayer: id === St.S.player.clubId, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gf - r.ga, pts: r.pts };
      });
      arr.sort(function (a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name); });
      return arr;
    },

    /* ---------------- 出场机会 ---------------- */
    starterChance: function () {
      var p = St.S.player, club = St.club();
      var diff = St.overall() - club.str;
      var c = 0.50 + diff * 0.046;
      c += (p.relations - 50) * 0.0035;
      c += p.form * 0.010;
      c += (p.condition - 65) * 0.0040;
      c += (p.reputation - 20) * 0.0015;
      return U.clamp(c, 0.02, 0.97);
    },

    /* 根据位置/能力/对手计算场景权重 */
    sceneWeights: function (opp) {
      var p = St.S.player, pos = BL.POSITIONS[p.pos].scene;
      var a = p.attrs;
      var teamStr = St.club().str, gap = (opp.str - teamStr);
      var harder = U.clamp(0.75 + gap * 0.012, 0.5, 1.6);
      var easier = U.clamp(1.2 - gap * 0.012, 0.5, 1.6);
      var relF = 0.78 + (p.relations / 100) * 0.5;
      return {
        shoot:   pos.shoot   * (0.55 + a.shooting / 78)  * relF * easier,
        pass:    pos.pass    * (0.60 + a.passing / 76)   * relF,
        dribble: pos.dribble * (0.60 + a.dribbling / 76) * relF * easier,
        defend:  pos.defend  * (0.60 + a.defending / 76) * harder * (gap > 0 ? 1.15 : 0.95)
      };
    },

    pickSceneTypes: function (n, opp) {
      var w = St.sceneWeights(opp), keys = Object.keys(w), out = [];
      for (var i = 0; i < n; i++) {
        var total = 0; keys.forEach(function (k) { total += w[k]; });
        var r = Math.random() * total, acc = 0, chosen = keys[0];
        for (var j = 0; j < keys.length; j++) {
          acc += w[keys[j]];
          if (r <= acc) { chosen = keys[j]; break; }
        }
        out.push(chosen);
        w[chosen] *= 0.45; /* 避免同一场比赛重复太多同类场景 */
      }
      return out;
    },

    /* ---------------- 每周活动 ---------------- */
    doActivity: function (key) {
      var p = St.S.player, club = St.club(), act = BL.ACT_MAP[key];
      if (!act) return { gains: {}, text: '' };
      var gains = {}, texts = [];
      p.condition = U.clamp(p.condition - act.cond, 5, 100);

      if (act.attr) {
        var g = St.trainGain(act.attr);
        gains[act.attr] = g;
        p.attrs[act.attr] = U.clamp(p.attrs[act.attr] + g, 1, 99);
        texts.push(BL.ATTR_MAP[act.attr].name + ' +' + U.round1(g));
        if (Math.random() < 0.22) {
          var others = BL.ATTRS.filter(function (a) { return a.key !== act.attr; });
          var o = U.pick(others).key, g2 = U.round1(St.trainGain(o) * 0.45);
          if (g2 > 0.05) { p.attrs[o] = U.clamp(p.attrs[o] + g2, 1, 99); gains[o] = g2; texts.push(BL.ATTR_MAP[o].name + ' +' + g2); }
        }
      } else if (key === 'rest') {
        var rec = 34 * (p.upgrades.physio ? 1.4 : 1) + p.attrs.physical * 0.12;
        p.condition = U.clamp(p.condition + rec, 0, 100);
        p.morale = U.clamp(p.morale + 6, 0, 100);
        p.form = U.clamp(p.form + 2, -10, 10);
        texts.push('体力 +' + Math.round(rec));
      } else if (key === 'social') {
        p.relations = U.clamp(p.relations + U.rndInt(6, 11), 0, 100);
        p.morale = U.clamp(p.morale + 7, 0, 100);
        texts.push('队内关系 +');
      } else if (key === 'media') {
        var m = Math.round(p.wage * U.rnd(0.6, 1.4) + p.reputation * 900);
        p.money += m;
        p.reputation = U.clamp(p.reputation + (p.upgrades.pr ? 3 : 2), 0, 100);
        p.morale = U.clamp(p.morale - 2, 0, 100);
        texts.push('收入 +¥' + m.toLocaleString('en-US'));
      }
      /* 自然恢复与衰减 */
      p.condition = U.clamp(p.condition + 10, 0, 100);
      p.morale = U.clamp(p.morale + (p.morale > 50 ? -1 : 1), 0, 100);
      p.relations = U.clamp(p.relations - 0.6, 0, 100);
      p.form = U.clamp(p.form * 0.92, -10, 10);
      p.money += Math.round(p.wage * 0.6);
      if (p.weeksOut > 0) {
        p.weeksOut--;
        if (p.weeksOut === 0) texts.push('伤势痊愈，可以复出');
      }
      return { gains: gains, texts: texts };
    },

    trainGain: function (attrKey) {
      var p = St.S.player, club = St.club(), cur = p.attrs[attrKey];
      var ageF = p.age <= 18 ? 1.55 : p.age <= 21 ? 1.28 : p.age <= 25 ? 1.0 : p.age <= 29 ? 0.58 : p.age <= 32 ? 0.3 : 0.12;
      var curF = cur >= 92 ? 0.05 : cur >= 84 ? 0.14 : cur >= 75 ? 0.28 : cur >= 65 ? 0.48 : cur >= 50 ? 0.72 : 1.0;
      var facF = 0.7 + (club.fac || 2) * 0.13;
      var condF = 0.62 + 0.38 * (p.condition / 100);
      var morF = 0.82 + 0.36 * (p.morale / 100);
      var upF = p.upgrades.coach ? 1.3 : 1;
      var base = 0.95;
      return U.round1(base * ageF * curF * facF * condF * morF * upF * U.rnd(0.7, 1.3));
    },

    /* ---------------- 事件 ---------------- */
    rollEvent: function () {
      var p = St.S.player, s = St.S;
      var pool = BL.EVENTS.filter(function (e) {
        if (e.once && s.log.indexOf('ev_' + e.id) >= 0) return false;
        if (e.minWeek && s.week < e.minWeek) return false;
        if (e.needConditionBelow && p.condition > e.needConditionBelow) return false;
        return true;
      });
      if (!pool.length) return null;
      return U.pick(pool);
    },

    applyEvent: function (ev, optIndex) {
      var p = St.S.player, opt = ev.options[optIndex], fx = opt.fx || {};
      var lines = [];
      BL.ATTRS.forEach(function (a) {
        if (fx[a.key]) { p.attrs[a.key] = U.clamp(p.attrs[a.key] + fx[a.key], 1, 99); lines.push(a.name + ' ' + (fx[a.key] > 0 ? '+' : '') + fx[a.key]); }
      });
      if (fx.relations) { p.relations = U.clamp(p.relations + fx.relations, 0, 100); lines.push('队内关系 ' + (fx.relations > 0 ? '+' : '') + fx.relations); }
      if (fx.morale) { p.morale = U.clamp(p.morale + fx.morale, 0, 100); lines.push('士气 ' + (fx.morale > 0 ? '+' : '') + fx.morale); }
      if (fx.condition) { p.condition = U.clamp(p.condition + fx.condition, 3, 100); lines.push('体力 ' + (fx.condition > 0 ? '+' : '') + fx.condition); }
      if (fx.form) { p.form = U.clamp(p.form + fx.form, -10, 10); lines.push('状态 ' + (fx.form > 0 ? '+' : '') + fx.form); }
      if (fx.money) { p.money += fx.money; lines.push('收入 +¥' + fx.money.toLocaleString('en-US')); }
      if (fx.reputation) { p.reputation = U.clamp(p.reputation + fx.reputation, 0, 100); lines.push('声望 ' + (fx.reputation > 0 ? '+' : '') + fx.reputation); }
      if (fx.injuryRisk && Math.random() * 100 < fx.injuryRisk) {
        p.weeksOut = Math.max(p.weeksOut, U.rndInt(2, 5));
        p.injuryName = '大腿拉伤';
        lines.push('伤情加重：' + p.injuryName + '（缺阵 ' + p.weeksOut + ' 周）');
      }
      St.S.log.push('ev_' + ev.id);
      return lines;
    },

    /* ---------------- 比赛结果应用 ---------------- */
    applyMatch: function (res) {
      var p = St.S.player, s = St.S;
      var se = s.season, ca = s.career;
      var lines = [];
      p.condition = U.clamp(p.condition - res.conditionCost, 3, 100);
      p.money += Math.round(p.wage * 0.4);

      if (res.played) {
        se.apps++; ca.apps++;
        se.mins += res.minutes;
        se.goals += res.stats.goals; ca.goals += res.stats.goals;
        se.assists += res.stats.assists; ca.assists += res.stats.assists;
        se.ratingSum += res.rating; se.ratings++; ca.ratingSum += res.rating; ca.ratings++;
        se.shots += res.stats.shots; se.keyPasses += res.stats.keyPasses;
        se.tackles += res.stats.tackles; se.dribbles += res.stats.dribbles;
        if (res.rating >= 8.0) se.motm++;
        if (res.gf > res.ga) se.wins++; else if (res.gf === res.ga) se.draws++; else se.losses++;

        /* 士气 / 状态 / 声望 / 关系 */
        var ratingDelta = res.rating - 6.6;
        p.morale = U.clamp(p.morale + Math.round(ratingDelta * 6), 0, 100);
        p.form = U.clamp(p.form + ratingDelta * 1.6, -10, 10);
        p.relations = U.clamp(p.relations + (res.stats.goals > 0 ? 2 : 0) + (res.rating > 7 ? 1 : 0) - (res.rating < 6 ? 1.5 : 0), 0, 100);
        var rep = (res.stats.goals * 0.55 + res.stats.assists * 0.35 + Math.max(0, ratingDelta) * 0.9) * (p.upgrades.pr ? 1.5 : 1);
        p.reputation = U.clamp(p.reputation + rep, 0, 100);

        /* 比赛带来的成长 */
        var growth = St.matchGrowth(res);
        for (var k in growth) if (growth[k] > 0.05) {
          p.attrs[k] = U.clamp(p.attrs[k] + growth[k], 1, 99);
          lines.push(BL.ATTR_MAP[k].name + ' +' + U.round1(growth[k]));
        }
        /* 伤病 */
        var injChance = (p.condition < 40 ? (40 - p.condition) * 0.8 : 0) + (p.weeksOut > 0 ? 4 : 0);
        if (Math.random() * 100 < injChance) {
          p.weeksOut = U.rndInt(1, 4);
          p.injuryName = U.pick(['脚踝扭伤', '大腿拉伤', '膝盖挫伤', '腹股沟拉伤']);
          lines.push('受伤：' + p.injuryName + '（缺阵 ' + p.weeksOut + ' 周）');
        }
      }
      return lines;
    },

    matchGrowth: function (res) {
      var p = St.S.player;
      var ageF = p.age <= 18 ? 1.5 : p.age <= 21 ? 1.25 : p.age <= 25 ? 0.95 : p.age <= 29 ? 0.5 : 0.2;
      var curF = function (k) { var c = p.attrs[k]; return c >= 88 ? 0.08 : c >= 78 ? 0.2 : c >= 68 ? 0.4 : c >= 55 ? 0.7 : 1; };
      var perfF = U.clamp(0.4 + (res.rating - 6.0) * 0.35, 0.15, 1.9);
      var out = {};
      var add = function (k, v) {
        if (!k) return;
        out[k] = U.round1((out[k] || 0) + v * ageF * curF(k) * perfF);
      };
      var c = res.sceneCounts || {};
      add('shooting', (c.shoot || 0) * 0.22);
      add('passing', (c.pass || 0) * 0.22);
      add('dribbling', (c.dribble || 0) * 0.22);
      add('defending', (c.defend || 0) * 0.22);
      add('pace', res.minutes * 0.0022);
      add('physical', res.minutes * 0.0026);
      return out;
    },

    /* ---------------- 赛季结束 ---------------- */
    endSeason: function () {
      var p = St.S.player, s = St.S, se = s.season;
      var table = St.tableSorted();
      var rank = 1;
      for (var i = 0; i < table.length; i++) if (table[i].isPlayer) rank = i + 1;
      var avg = se.ratings ? U.round1(se.ratingSum / se.ratings) : 0;
      var gained = [];

      var leagueTopGoals = U.rndInt(11, 20), leagueTopAssists = U.rndInt(9, 16);
      var leagueTopRating = U.round1(U.rnd(7.4, 8.1));
      s.leagueTopGoals = leagueTopGoals;
      s.leagueTopAssists = leagueTopAssists;
      s.leagueTopRating = leagueTopRating;

      if (rank === 1) gained.push('league_title');
      if (se.goals >= leagueTopGoals && se.apps >= 10) gained.push('top_scorer');
      if (se.assists >= leagueTopAssists && se.apps >= 10) gained.push('top_assist');
      if (se.apps >= 12 && avg >= Math.max(7.5, leagueTopRating)) gained.push('league_mvp');
      if (p.age <= 21 && se.apps >= 8 && avg >= 7.0) gained.push('best_young');
      if (se.apps >= 10 && avg >= 7.4) gained.push('club_potm');
      if (s.league.tier === 1 && se.apps >= 14 && avg >= 7.9 && (se.goals + se.assists) >= 26) gained.push('ballon_dor');

      gained.forEach(function (h) {
        var info = BL.HONOR_INFO[h];
        s.honors.push({ key: h, name: info.name, season: s.seasonNo, club: St.club().name });
        s.career.honors.push({ key: h, name: info.name, season: s.seasonNo, club: St.club().name });
        p.reputation = U.clamp(p.reputation + (h === 'ballon_dor' ? 20 : h === 'league_title' ? 6 : 9), 0, 100);
        p.morale = U.clamp(p.morale + 10, 0, 100);
      });

      /* 赛季成长（老将下滑） */
      var attrLines = [];
      BL.ATTRS.forEach(function (a) {
        var k = a.key, cur = p.attrs[k], d;
        if (p.age <= 21) d = U.rnd(0.8, 2.6);
        else if (p.age <= 25) d = U.rnd(0.4, 1.6);
        else if (p.age <= 29) d = U.rnd(-0.2, 0.9);
        else d = U.rnd(-2.2, 0.3);
        d *= (cur >= 85 ? 0.35 : cur >= 72 ? 0.7 : 1.15);
        d = U.round1(d);
        if (Math.abs(d) >= 0.1) {
          p.attrs[k] = U.clamp(cur + d, 1, 99);
          attrLines.push({ name: a.name, d: d });
        }
      });

      var summary = {
        season: s.seasonNo, age: p.age, club: St.club().name, tier: s.league.tier,
        rank: rank, apps: se.apps, goals: se.goals, assists: se.assists, avg: avg,
        honors: gained.map(function (h) { return BL.HONOR_INFO[h].name; }),
        attrLines: attrLines, ovr: St.overall(),
        leagueTopGoals: leagueTopGoals, leagueTopAssists: leagueTopAssists, leagueTopRating: leagueTopRating
      };
      s.history.push(summary);
      s.career.seasons++;
      s.lastSummary = summary;

      /* 转会报价 */
      s.offers = St.makeOffers(avg, rank);
      return summary;
    },

    makeOffers: function (avg, rank) {
      var p = St.S.player, cur = St.club(), ovr = St.overall();
      var cands = BL.CLUBS.filter(function (c) {
        if (c.id === cur.id) return false;
        if (c.str <= (cur.str || 55) - 2) return false;
        if (c.str > ovr + 9) return false;
        if (c.tier < (cur.tier || 3) && c.str < (cur.str || 55) + 6) return false;
        return true;
      });
      var score = (avg - 6.4) * 12 + (p.reputation - 10) * 0.9 + (ovr - 55) * 0.5;
      cands = cands.filter(function (c) { return score + U.rnd(-12, 12) > (c.str - 55) * 1.5; });
      /* 高 tier 更吸引人，优先列出 */
      cands.sort(function (a, b) { return b.str - a.str; });
      var picked = U.shuffle(cands.slice(0, 6)).slice(0, 3);
      return picked.map(function (c) {
        return { clubId: c.id, name: c.name, str: c.str, tier: c.tier, kit: c.kit,
                 wage: Math.round(c.wage * U.rnd(0.5, 0.95)), fee: Math.round(c.wage * U.rnd(6, 14)) };
      });
    },

    acceptOffer: function (offer) {
      var p = St.S.player;
      p.clubId = offer.clubId;
      p.wage = offer.wage;
      p.relations = U.clamp(p.relations - 6, 0, 100);
      p.morale = U.clamp(p.morale + 12, 0, 100);
      p.reputation = U.clamp(p.reputation + 4, 0, 100);
      St.S.offers = null;
      St.makeLeague();
    },

    startNewSeason: function () {
      var s = St.S, p = s.player;
      s.seasonNo++;
      p.age++;
      s.week = 1;
      s.season = St.emptySeason();
      s.roundIndex = 0;
      s.offers = null;
      s.log = [];
      s.pendingSeasonEnd = false;
      St.makeLeague();
    },

    /* ---------------- 商店 ---------------- */
    buy: function (key) {
      var p = St.S.player, item = null;
      BL.SHOP.forEach(function (i) { if (i.key === key) item = i; });
      if (!item || p.upgrades[key] || p.money < item.price) return false;
      p.money -= item.price;
      p.upgrades[key] = true;
      return true;
    },

    /* ---------------- 存档 ---------------- */
    save: function () {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(St.S)); } catch (e) { /* file:// 下可能不可用 */ }
    },
    hasSave: function () {
      /* 不能只看有没有 key：损坏的存档会让 hasSave() 与 load() 结果不一致 */
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        var s = JSON.parse(raw);
        return !!(s && s.player && s.player.attrs);
      } catch (e) { return false; }
    },
    load: function () {
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        var s = JSON.parse(raw);
        if (!s || !s.player || !s.player.attrs) return false;
        /* 补齐可能缺失的字段：旧版本存档在新版本里也能正常载入，
           否则刷新后会因为读不到字段而报错 */
        if (!s.season) s.season = St.emptySeason();
        if (!s.career) s.career = { apps: 0, goals: 0, assists: 0, ratingSum: 0, ratings: 0, honors: [], seasons: 0 };
        s.career.honors = s.career.honors || [];
        s.honors = s.honors || [];
        s.history = s.history || [];
        s.log = s.log || [];
        s.week = s.week || 1;
        s.seasonNo = s.seasonNo || 1;
        s.roundIndex = s.roundIndex || 0;
        s.weekDone = !!s.weekDone;
        s.player.upgrades = s.player.upgrades || {};
        s.player.weeksOut = s.player.weeksOut || 0;
        s.player.look = s.player.look || { skin: '#e8b48a', hair: '#2a1d16' };
        BL.ATTRS.forEach(function (a) {
          if (typeof s.player.attrs[a.key] !== 'number') s.player.attrs[a.key] = 40;
        });
        if (!s.player.pos || !BL.POSITIONS[s.player.pos]) s.player.pos = 'ST';
        if (!BL.CLUB_MAP[s.player.clubId]) return false;   /* 认不出俱乐部，视为坏档 */
        St.S = s;
        if (!s.league || !s.league.teams || !s.fixtures) St.makeLeague();
        return true;
      } catch (e) { return false; }
    },
    wipe: function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      St.S = null;
    }
  };

})(window.BL);
