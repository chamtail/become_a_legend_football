/* ============================================================
 *  ui.js — 界面：主菜单 / 创建球员 / 生涯主界面 / 事件 / 商店
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';
  var U = BL.U, St = BL.State, P = BL.Px;
  var UI = BL.UI = {};

  UI.screenEl = null; UI.hintEl = null; UI.topEl = null;
  UI.cur = { name: 'menu', params: {} };
  UI.pendingEvent = null;

  /* ---------------- 基础 ---------------- */
  UI.el = function (html) { var d = document.createElement('div'); d.innerHTML = html; return d; };
  UI.esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  UI.toast = function (text, type) {
    var layer = document.getElementById('toast-layer');
    var t = UI.el('<div class="toast ' + (type || '') + '">' + UI.esc(text) + '</div>');
    layer.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  };

  UI.modal = function (opt) {
    var layer = document.getElementById('modal-layer');
    layer.classList.remove('hidden');
    var h = ['<div class="modal">'];
    if (opt.title) h.push('<h2>' + opt.title + '</h2>');
    if (opt.body) h.push(opt.body);
    h.push('<div class="btn-col" id="modal-actions"></div>');
    h.push('</div>');
    layer.innerHTML = h.join('');
    var acts = document.getElementById('modal-actions');
    (opt.actions || []).forEach(function (a) {
      var b = UI.el('<button class="btn ' + (a.cls || '') + '">' + a.label + '</button>');
      b.addEventListener('click', function () {
        if (a.keepOpen !== true) UI.closeModal();
        if (a.onClick) a.onClick();
      });
      acts.appendChild(b);
    });
    if (!opt.actions || !opt.actions.length) {
      var b2 = UI.el('<button class="btn primary">继续</button>');
      b2.addEventListener('click', function () { UI.closeModal(); if (opt.onClose) opt.onClose(); });
      acts.appendChild(b2);
    }
  };
  UI.closeModal = function () {
    var layer = document.getElementById('modal-layer');
    layer.classList.add('hidden'); layer.innerHTML = '';
  };

  /* ---------------- 版本 ---------------- */
  UI.versionText = function () { return 'v' + BL.VERSION.num; };

  UI.refreshVersionLabel = function () {
    var el = document.getElementById('ver');
    if (el) el.textContent = UI.versionText();
  };

  /* 强制重新加载：换掉 index.html 的 URL，避免拿到缓存里的旧页面 */
  UI.hardReload = function () {
    try { location.href = location.pathname + '?v=' + Date.now(); }
    catch (e) { location.reload(); }
  };

  /* 拉取 version.json（带时间戳绕过 CDN 缓存）比对版本 */
  UI.checkVersion = function (cb) {
    cb = cb || function () {};
    if (typeof fetch !== 'function') { cb(null); return; }
    if (typeof location === 'undefined' || (location.protocol !== 'http:' && location.protocol !== 'https:')) { cb(null); return; }
    try {
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { cb(d && d.version ? d : null); })
        .catch(function () { cb(null); });
    } catch (e) { cb(null); }
  };

  UI.versionModal = function () {
    var v = BL.VERSION;
    UI.modal({
      title: '版本信息',
      body: '<p>当前版本 <b class="green">v' + v.num + '</b>　<span class="dim2">' + v.date + '</span></p>' +
            '<p class="dim2">' + UI.esc(v.note || '') + '</p>' +
            '<div class="dim2 mt6" id="ver-check">正在检查更新……</div>',
      actions: [
        { label: '强制刷新页面', cls: 'primary', onClick: function () { UI.hardReload(); } },
        { label: '关闭' }
      ]
    });
    UI.checkVersion(function (remote) {
      var box = document.getElementById('ver-check');
      if (!box) return;
      if (!remote) { box.innerHTML = '无法检查更新（本地文件打开或离线）。'; return; }
      if (String(remote.version) === String(v.num)) { box.innerHTML = '<span class="green">已是最新版本</span>'; return; }
      box.innerHTML = '<span class="yellow">发现新版本 v' + remote.version + '</span>';
      var b = UI.el('<button class="btn sm" style="margin-left:8px">立即更新</button>');
      b.addEventListener('click', function () { UI.hardReload(); });
      box.appendChild(b);
    });
  };

  /* 启动时静默检查，有新版本就在顶部挂一条提示 */
  UI.maybeShowUpdateBar = function () {
    UI.checkVersion(function (remote) {
      if (!remote || String(remote.version) === String(BL.VERSION.num)) return;
      if (document.getElementById('update-bar')) return;
      var app = document.getElementById('app');
      if (!app) return;
      var bar = UI.el('<div id="update-bar">发现新版本 <b>v' + remote.version + '</b>（当前 v' + BL.VERSION.num + '）· 点击此处刷新</div>');
      bar.addEventListener('click', function () { UI.hardReload(); });
      app.insertBefore(bar, app.firstChild);
    });
  };

  /* ---------------- 顶栏 ---------------- */
  UI.topbar = function () {
    var bar = document.getElementById('topstats');
    if (!St.S) { bar.innerHTML = ''; return; }
    var p = St.S.player, club = St.club();
    var cCol = p.condition > 65 ? 'good' : p.condition > 35 ? 'warn' : 'bad';
    var mCol = p.morale > 60 ? 'good' : p.morale > 30 ? 'warn' : 'bad';
    var h = [];
    h.push('<div class="topstat"><span class="k">球员</span><span class="v">' + UI.esc(p.name) + ' <span class="dim2">' + BL.POSITIONS[p.pos].abbr + '</span></span></div>');
    h.push('<div class="topstat"><span class="k">俱乐部</span><span class="v">' + UI.esc(club.name) + '</span></div>');
    h.push('<div class="topstat"><span class="k">综合</span><span class="v good">' + St.overall() + '</span></div>');
    h.push('<div class="topstat"><span class="k">体力</span><span class="v ' + cCol + '">' + Math.round(p.condition) + '</span></div>');
    h.push('<div class="topstat"><span class="k">士气</span><span class="v ' + mCol + '">' + Math.round(p.morale) + '</span></div>');
    h.push('<div class="topstat"><span class="k">声望</span><span class="v">' + Math.round(p.reputation) + '</span></div>');
    h.push('<div class="topstat"><span class="k">资金</span><span class="v">¥' + p.money.toLocaleString('en-US') + '</span></div>');
    h.push('<div class="topstat"><span class="k">赛季</span><span class="v">第' + St.S.seasonNo + '季 第' + Math.min(St.S.week, 18) + '轮</span></div>');
    bar.innerHTML = h.join('');
  };

  UI.setHint = function (t) { document.getElementById('hint-text').innerHTML = t; };

  UI.go = function (name, params) { UI.cur = { name: name, params: params || {} }; UI.render(); };

  UI.render = function () {
    UI.screenEl = document.getElementById('screen');
    UI.topbar();
    /* 安全网：没有生涯数据时，只有主菜单和创建页可以直接渲染，
       其余界面（被刷新、存档读取失败、旧存档损坏等）一律退回主菜单 */
    if (!St.S && UI.cur.name !== 'menu' && UI.cur.name !== 'create') {
      UI.cur = { name: 'menu', params: {} };
    }
    var fn = UI.screens[UI.cur.name] || UI.screens.menu;
    UI.refreshVersionLabel();
    UI.screenEl.innerHTML = '';
    var node = fn(UI.cur.params);
    node.classList.add('fade');
    UI.screenEl.appendChild(node);
    UI.screenEl.scrollTop = 0;
  };

  /* ---------------- 通用片段 ---------------- */
  UI.attrLine = function (a, v, delta) {
    var d = delta ? '<span class="dim2"> ' + (delta > 0 ? '+' : '') + delta + '</span>' : '';
    return '<div class="statline"><span class="nm">' + a.name + '</span>' +
      '<div class="bar"><i style="width:' + Math.min(100, v) + '%;background:' + a.color + '"></i></div>' +
      '<span class="vl" style="color:' + a.color + '">' + Math.round(v) + d + '</span></div>';
  };
  UI.miniBar = function (label, v, color, max) {
    max = max || 100;
    return '<div class="statline"><span class="nm">' + label + '</span>' +
      '<div class="bar"><i style="width:' + Math.min(100, v / max * 100) + '%;background:' + color + '"></i></div>' +
      '<span class="vl">' + Math.round(v) + '</span></div>';
  };

  UI.screens = {};

  /* ================= 主菜单 ================= */
  UI.screens.menu = function () {
    UI.setHint('用鼠标或手指在球场上划出轨迹 —— 射门、传球、盘带、防守');
    /* 以内存中的生涯数据为准：hasSave() 只看 localStorage 里有没有 key，
       若存档读取失败或格式损坏，两者会不一致，直接读 St.S.player 就会崩 */
    var p = St.S ? St.S.player : null;
    var h = [];
    h.push('<div class="panel center" style="padding:26px 14px">');
    h.push('<div style="font-size:44px;letter-spacing:10px;color:#57cc72;text-shadow:4px 4px 0 #08240f, 0 0 22px rgba(87,204,114,.35)">成为传奇</div>');
    h.push('<div class="dim2" style="letter-spacing:8px;margin-top:6px">B E C O M E &nbsp; A &nbsp; L E G E N D</div>');
    h.push('<div class="dim" style="margin-top:14px;font-size:12px;line-height:1.9">从青训营的无名少年，到世界足球先生。<br>每周安排训练与生活，每场比赛在关键时刻亲手划出决定命运的轨迹。</div>');
    h.push('<div class="dim2 mt10">版本 <b class="green">v' + BL.VERSION.num + '</b> · ' + BL.VERSION.date + '　<span style="opacity:.7">点右下角版本号可检查更新</span></div>');
    h.push('</div>');

    h.push('<div class="grid2">');
    h.push('<div class="panel"><div class="panel-title">生涯</div><div class="btn-col">');
    if (p) {
      h.push('<button class="btn primary wide" data-act="continue">继续生涯</button>');
      h.push('<button class="btn wide" data-act="new">重新开始</button>');
    } else {
      h.push('<button class="btn primary wide" data-act="new">开始新的生涯</button>');
    }
    h.push('<button class="btn wide" data-act="how">玩法说明</button>');
    h.push('</div></div>');

    h.push('<div class="panel"><div class="panel-title">数据</div>');
    if (p) {
      h.push('<div class="dim2">存档：' + UI.esc(p.name) + ' · ' + St.club().name + ' · 第' + St.S.seasonNo + '赛季</div>');
      h.push('<div class="dim2 mt6">年龄 ' + p.age + ' ｜ 综合 ' + St.overall() + ' ｜ 生涯出场 ' + St.S.career.apps + ' ｜ 进球 ' + St.S.career.goals + '</div>');
      var hs = St.S.career.honors.slice(-4).map(function (x) { return x.name; }).join('、');
      h.push('<div class="dim2 mt6">荣誉：' + (hs || '暂无') + '</div>');
    } else {
      h.push('<div class="dim2">还没有存档。点击左侧开始你的生涯。</div>');
    }
    h.push('</div></div>');

    var node = UI.el(h.join(''));
    node.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'new') {
        if (St.S || St.hasSave()) {
          UI.modal({ title: '重新开始', body: '<p>当前存档将被覆盖，确定吗？</p>', actions: [
            { label: '确定覆盖', cls: 'danger', onClick: function () { St.wipe(); UI.go('create'); } },
            { label: '取消', cls: '' }
          ] });
        } else UI.go('create');
      } else if (act === 'continue') {
        if (St.S || St.load()) UI.go('hub');
        else { UI.toast('读取存档失败，已清除损坏的存档', 'bad'); St.wipe(); UI.go('menu'); }
      } else if (act === 'how') {
        UI.modal({
          title: '玩法说明', body:
            '<p><b class="green">1. 每周安排</b><br>选择训练、休息、社交或商业活动。训练提升属性，但会消耗体力。</p>' +
            '<p><b class="green">2. 比赛高光</b><br>比赛中会出现高光时刻：射门、传球、盘带、防守。用鼠标或手指<b class="yellow">从球的位置划出一条轨迹</b>，轨迹的终点、形状与长度都会被判定。</p>' +
            '<p><b class="green">3. 能力影响难度</b><br>能力越高，容错圈越大、划动时间越充裕、对手的抢断圈越小。</p>' +
            '<p><b class="green">4. 成长与荣誉</b><br>比赛和训练都会带来成长。赛季结束评选最佳射手、MVP、世界足球先生，也可能收到豪门报价。</p>'
        });
      }
    });
    return node;
  };

  /* ================= 创建球员 ================= */
  var LOOKS = [
    { skin: '#e8b48a', hair: '#2a1d16' }, { skin: '#c98d5e', hair: '#151009' },
    { skin: '#8d5a34', hair: '#120d08' }, { skin: '#f0c9a0', hair: '#5a3a1c' },
    { skin: '#e8b48a', hair: '#c9a227' }, { skin: '#c98d5e', hair: '#3b2a1a' }
  ];

  UI.screens.create = function () {
    UI.setHint('分配你的初始属性 —— 点击 +/- 调整，或选择一个模板');
    var pos = 'ST';
    var attrs = { shooting: 28, passing: 28, dribbling: 28, defending: 28, pace: 28, physical: 28 };
    var POOL = 132;
    var CAP = 72;
    var look = LOOKS[Math.floor(Math.random() * LOOKS.length)];
    var name = ['林', '陈', '王', '李', '赵', '孙', '周', '吴'][Math.floor(Math.random() * 8)] + ['一鸣', '子豪', '锐', '天赐', '皓宇', '凌', '嘉树'][Math.floor(Math.random() * 7)];
    var offers = U.shuffle(BL.CLUBS.filter(function (c) { return c.tier === 3; })).slice(0, 3);
    var clubId = offers[0].id;

    var PRESETS = {
      ST: { shooting: 58, passing: 32, dribbling: 46, defending: 22, pace: 54, physical: 48 },
      W: { shooting: 46, passing: 42, dribbling: 58, defending: 24, pace: 60, physical: 34 },
      AM: { shooting: 44, passing: 58, dribbling: 50, defending: 26, pace: 44, physical: 34 },
      CM: { shooting: 36, passing: 60, dribbling: 40, defending: 40, pace: 38, physical: 46 },
      DM: { shooting: 28, passing: 46, dribbling: 30, defending: 58, pace: 36, physical: 54 },
      FB: { shooting: 26, passing: 44, dribbling: 36, defending: 54, pace: 56, physical: 42 },
      CB: { shooting: 22, passing: 34, dribbling: 24, defending: 62, pace: 44, physical: 58 }
    };

    var h = [];
    h.push('<div class="panel"><div class="panel-title">创建球员<span class="right">第 1 步 / 共 1 步</span></div>');
    h.push('<div class="grid2">');
    /* 左：外观与基本信息 */
    h.push('<div>');
    h.push('<div class="avatar-wrap"><canvas class="avatar" id="cv-avatar"></canvas><div class="t"><b class="big" id="pv-name">' + name + '</b><div class="dim2" id="pv-club">' + offers[0].name + '</div><div class="dim2" id="pv-ovr">综合 44</div></div></div>');
    h.push('<div class="mt10 dim2">姓名</div><input class="nameinput" id="in-name" maxlength="8" value="' + name + '">');
    h.push('<div class="mt10 dim2">外观</div><div class="row" id="looks"></div>');
    h.push('</div>');
    /* 右：位置 */
    h.push('<div>');
    h.push('<div class="dim2">位置（决定高光场景的类型与频率）</div>');
    h.push('<div class="posgrid mt6" id="posgrid"></div>');
    h.push('<div class="dim2 mt10">起始俱乐部</div>');
    h.push('<div class="mt6" id="clubs"></div>');
    h.push('</div>');
    h.push('</div></div>');

    /* 属性分配 */
    h.push('<div class="panel"><div class="panel-title">属性分配<span class="right">剩余点数 <b id="pool" class="yellow">' + POOL + '</b></span></div>');
    h.push('<div class="grid2"><div id="attrbox"></div>');
    h.push('<div><div class="dim2">提示</div><div class="dim2 mt6" id="attr-tip">选择位置后自动套用推荐模板。</div>');
    h.push('<hr class="sep"><div class="btn-col">');
    h.push('<button class="btn sm" data-p="re">套用位置模板</button>');
    h.push('<button class="btn sm" data-p="avg">平均分配</button>');
    h.push('</div></div></div></div>');

    h.push('<div class="panel center"><button class="btn primary" id="btn-start" style="padding:12px 30px;font-size:15px">开始我的生涯</button></div>');

    var node = UI.el(h.join(''));

    function spent() { var t = 0; BL.ATTRS.forEach(function (a) { t += attrs[a.key] - 28; }); return t; }
    function recomputeOvr() {
      var w = BL.POSITIONS[pos].ovr, sum = 0;
      for (var k in w) sum += attrs[k] * w[k];
      return Math.round(sum);
    }
    function drawAvatar() { P.avatar(node.querySelector('#cv-avatar'), { skin: look.skin, hair: look.hair, kit: BL.CLUB_MAP[clubId].kit }); }
    function refresh() {
      node.querySelector('#pool').textContent = POOL - spent();
      var box = node.querySelector('#attrbox');
      box.innerHTML = BL.ATTRS.map(function (a) {
        return '<div class="statline" style="grid-template-columns:48px 1fr 26px 38px 38px">' +
          '<span class="nm">' + a.name + '</span>' +
          '<div class="bar"><i style="width:' + attrs[a.key] + '%;background:' + a.color + '"></i></div>' +
          '<span class="vl" style="color:' + a.color + '">' + attrs[a.key] + '</span>' +
          '<button class="btn sm" data-a="' + a.key + '" data-d="-1" style="padding:7px 0;width:100%">−</button>' +
          '<button class="btn sm" data-a="' + a.key + '" data-d="1" style="padding:7px 0;width:100%">+</button>' +
          '</div>';
      }).join('');
      node.querySelector('#pv-ovr').textContent = '综合 ' + recomputeOvr();
      node.querySelector('#pv-club').textContent = BL.CLUB_MAP[clubId].name + ' · ' + BL.POSITIONS[pos].name;
      node.querySelector('#pv-name').textContent = name;
      drawAvatar();
    }
    function applyPreset() {
      var pr = PRESETS[pos], total = 0;
      for (var k in pr) total += pr[k] - 28;
      var scale = total > POOL ? POOL / total : 1;
      BL.ATTRS.forEach(function (a) {
        attrs[a.key] = Math.min(CAP, Math.round(28 + (pr[a.key] - 28) * scale));
      });
      /* 若没花完，补到主属性 */
      var left = POOL - spent(), keys = Object.keys(BL.POSITIONS[pos].ovr).sort(function (x, y) { return BL.POSITIONS[pos].ovr[y] - BL.POSITIONS[pos].ovr[x]; });
      var i = 0;
      while (left > 0 && i < 400) {
        var k2 = keys[i % keys.length];
        if (attrs[k2] < CAP) { attrs[k2]++; left--; }
        i++;
        if (i > 200 && BL.ATTRS.every(function (a) { return attrs[a.key] >= CAP; })) break;
      }
      refresh();
    }

    /* 位置按钮 */
    node.querySelector('#posgrid').innerHTML = BL.POS_KEYS.map(function (k) {
      return '<div class="posbtn' + (k === pos ? ' sel' : '') + '" data-pos="' + k + '"><b>' + BL.POSITIONS[k].abbr + '</b><small>' + BL.POSITIONS[k].name + '</small></div>';
    }).join('');
    /* 俱乐部 */
    function drawClubs() {
      node.querySelector('#clubs').innerHTML = offers.map(function (c) {
        return '<div class="cardrow' + (c.id === clubId ? ' sel' : '') + '" data-club="' + c.id + '">' +
          '<span class="kit" style="background:' + c.kit[0] + '"></span>' +
          '<div class="t"><b>' + c.name + '</b><small>实力 ' + c.str + ' ｜ 设施 ' + c.fac + ' ｜ 周薪 ¥' + c.wage.toLocaleString('en-US') + '</small></div>' +
          '</div>';
      }).join('');
    }
    drawClubs();
    /* 外观按钮 */
    function drawLooks() {
      node.querySelector('#looks').innerHTML = LOOKS.map(function (l, i) {
        return '<div class="posbtn' + (l === look ? ' sel' : '') + '" data-look="' + i + '" style="padding:3px"><div style="width:26px;height:26px;background:' + l.skin + ';border:2px solid ' + l.hair + ';margin:auto"></div></div>';
      }).join('');
    }
    drawLooks();

    node.addEventListener('click', function (e) {
      var t = e.target;
      var posBtn = t.closest ? t.closest('[data-pos]') : null;
      var cl = t.closest ? t.closest('[data-club]') : null;
      var lk = t.closest ? t.closest('[data-look]') : null;
      var ab = t.closest ? t.closest('[data-a]') : null;
      var pb = t.closest ? t.closest('[data-p]') : null;
      if (posBtn) {
        pos = posBtn.getAttribute('data-pos'); drawPos(); applyPreset(); drawClubs();
      } else if (cl) { clubId = cl.getAttribute('data-club'); drawClubs(); refresh(); }
      else if (lk) { look = LOOKS[+lk.getAttribute('data-look')]; drawLooks(); refresh(); }
      else if (ab) {
        var k = ab.getAttribute('data-a'), d = +ab.getAttribute('data-d');
        if (d > 0) { if (spent() < POOL && attrs[k] < CAP) attrs[k]++; }
        else { if (attrs[k] > 28) attrs[k]--; }
        refresh();
      } else if (pb) {
        var p = pb.getAttribute('data-p');
        if (p === 're') applyPreset();
        else {
          BL.ATTRS.forEach(function (a) { attrs[a.key] = 28; });
          var left = POOL, order = U.shuffle(BL.ATTRS.slice());
          var guard = 0;
          while (left > 0 && guard < 3000) {
            var a2 = order[guard % order.length];
            if (attrs[a2.key] < CAP) { attrs[a2.key]++; left--; }
            guard++;
          }
          refresh();
        }
      }
    });
    function drawPos() {
      node.querySelectorAll('[data-pos]').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-pos') === pos); });
    }
    node.querySelector('#in-name').addEventListener('input', function (e) { name = e.target.value || '无名氏'; refresh(); });
    node.querySelector('#btn-start').addEventListener('click', function () {
      if (spent() < POOL) {
        UI.modal({ title: '还有剩余点数', body: '<p>你还有 <b class="yellow">' + (POOL - spent()) + '</b> 点属性没有分配，确定就这样开始吗？</p>', actions: [
          { label: '继续分配' }, { label: '就这样开始', cls: 'primary', onClick: doStart }
        ] });
        return;
      }
      doStart();
    });
    function doStart() {
      St.newGame({ name: name, pos: pos, attrs: attrs, clubId: clubId });
      St.S.player.look = look;
      St.S.player.avatar = look;
      St.save();
      UI.toast('生涯开始了！', '');
      UI.go('hub');
    }
    refresh(); applyPreset();
    return node;
  };

  /* ================= 生涯主界面 ================= */
  UI.screens.hub = function () {
    var s = St.S, p = s.player, club = St.club();
    UI.setHint('选择本周的安排，然后进入比赛 —— 能力越强，比赛中的操作越轻松');
    var look = p.look || LOOKS[0];
    var fx = St.playerFixture();
    var opp = fx ? St.clubById(fx.home === p.clubId ? fx.away : fx.home) : null;
    var isHome = fx ? fx.home === p.clubId : true;
    var chance = St.starterChance();
    var table = St.tableSorted();

    var h = [];
    h.push('<div class="grid2">');

    /* ---- 左：球员卡 ---- */
    h.push('<div>');
    h.push('<div class="panel"><div class="panel-title">球员档案<span class="right">第 ' + s.seasonNo + ' 赛季</span></div>');
    h.push('<div class="avatar-wrap"><canvas class="avatar" id="cv-me"></canvas><div class="t">');
    h.push('<b class="big">' + UI.esc(p.name) + '</b>');
    h.push('<div class="dim2">' + BL.POSITIONS[p.pos].name + ' ' + BL.POSITIONS[p.pos].abbr + ' ｜ ' + p.age + ' 岁 ｜ ' + club.name + '</div>');
    h.push('<div class="mt6"><span class="pill g">综合 ' + St.overall() + '</span> <span class="pill b">周薪 ¥' + p.wage.toLocaleString('en-US') + '</span>' + (p.weeksOut > 0 ? ' <span class="pill r">伤停 ' + p.weeksOut + ' 周</span>' : '') + '</div>');
    h.push('</div></div>');
    h.push('<hr class="sep">');
    BL.ATTRS.forEach(function (a) { h.push(UI.attrLine(a, p.attrs[a.key])); });
    h.push('<hr class="sep">');
    h.push(UI.miniBar('体力', p.condition, p.condition > 65 ? '#57cc72' : p.condition > 35 ? '#f5c542' : '#e05555'));
    h.push(UI.miniBar('士气', p.morale, '#4d9de0'));
    h.push(UI.miniBar('队内关系', p.relations, '#a78bfa'));
    h.push(UI.miniBar('声望', p.reputation, '#f5c542'));
    h.push('<div class="statline"><span class="nm">状态</span><div class="bar"><i style="width:' + ((p.form + 10) / 20 * 100) + '%;background:' + (p.form >= 0 ? '#57cc72' : '#e05555') + '"></i></div><span class="vl">' + (p.form > 0 ? '+' : '') + Math.round(p.form) + '</span></div>');
    h.push('</div>');

    /* 本赛季数据 */
    var se = s.season;
    var avg = se.ratings ? U.round1(se.ratingSum / se.ratings) : 0;
    h.push('<div class="panel"><div class="panel-title">本赛季</div>');
    h.push('<div class="grid3" style="gap:4px">');
    [['出场', se.apps], ['进球', se.goals], ['助攻', se.assists], ['均分', avg || '-'], ['最佳', se.motm], ['分钟', se.mins]]
      .forEach(function (kv) {
        h.push('<div class="center"><div class="big yellow">' + kv[1] + '</div><div class="dim2">' + kv[0] + '</div></div>');
      });
    h.push('</div></div>');
    h.push('</div>');

    /* ---- 右：本周 / 积分榜 ---- */
    h.push('<div>');

    /* 下一场比赛 */
    h.push('<div class="panel"><div class="panel-title">下一场比赛<span class="right">第 ' + Math.min(s.week, 18) + ' / 18 轮</span></div>');
    if (opp) {
      h.push('<div class="spread"><div class="team"><span class="kit" style="background:' + club.kit[0] + '"></span>' + club.name + '</div>');
      h.push('<div class="big">VS</div>');
      h.push('<div class="team"><span class="kit" style="background:' + opp.kit[0] + '"></span>' + opp.name + '</div></div>');
      h.push('<div class="center dim2 mt6">' + (isHome ? '主场' : '客场') + ' ｜ 对手实力 ' + opp.str + ' ｜ 预计出场概率 ' + Math.round(chance * 100) + '%</div>');
      h.push('<div class="center mt6">' + (p.weeksOut > 0 ? '<span class="pill r">伤停中</span>' : chance > 0.75 ? '<span class="pill g">主力</span>' : chance > 0.45 ? '<span class="pill y">轮换</span>' : '<span class="pill r">替补</span>') + '</div>');
    } else h.push('<div class="dim2">赛程结束</div>');
    h.push('<div class="btn-col mt10" id="matchbtns"></div>');
    h.push('</div>');

    /* 本周安排 */
    h.push('<div class="panel"><div class="panel-title">本周安排<span class="right" id="act-state">' + (s.weekDone ? '已完成' : '未安排') + '</span></div>');
    h.push('<div class="grid3 acts" style="gap:6px" id="acts">');
    BL.ACTIVITIES.forEach(function (a) {
      h.push('<button class="btn sm" data-act="' + a.key + '"' + (s.weekDone ? ' disabled' : '') + ' style="flex-direction:column;align-items:flex-start;padding:6px 8px;line-height:1.35">' +
        '<span>' + a.icon + ' ' + a.name + '</span>' +
        '<span class="dim2" style="font-size:9px">' + (a.cond < 0 ? '恢复体力' : '体力 -' + a.cond) + '</span></button>');
    });
    h.push('</div>');
    h.push('<div class="dim2 mt6" id="act-log">' + (s.weekLog || '训练与生活都会影响你的状态和成长。') + '</div>');
    h.push('</div>');

    /* 积分榜 */
    h.push('<div class="panel"><div class="panel-title">' + BL.TIER_NAME[s.league.tier] + ' 积分榜</div>');
    h.push('<table class="tbl"><tr><th>#</th><th>球队</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>净</th><th>分</th></tr>');
    table.forEach(function (r, i) {
      h.push('<tr class="' + (r.isPlayer ? 'me' : (i % 2 ? 'odd' : '')) + '">' +
        '<td>' + (i + 1) + '</td><td>' + UI.esc(r.name) + '</td><td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td><td>' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td><b>' + r.pts + '</b></td></tr>');
    });
    h.push('</table></div>');

    /* 荣誉 */
    if (s.honors.length) {
      h.push('<div class="panel"><div class="panel-title">荣誉室<span class="right">共 ' + s.honors.length + ' 项</span></div>');
      h.push('<div class="row">');
      s.honors.slice().reverse().forEach(function (x) {
        var info = BL.HONOR_INFO[x.key] || { color: '#fff', icon: '' };
        h.push('<span class="pill" style="border-color:' + info.color + ';color:' + info.color + '">' + info.name + ' · S' + x.season + '</span>');
      });
      h.push('</div></div>');
    }
    h.push('</div></div>');

    var node = UI.el(h.join(''));
    P.avatar(node.querySelector('#cv-me'), { skin: look.skin, hair: look.hair, kit: club.kit });

    /* 比赛按钮 */
    var mb = node.querySelector('#matchbtns');
    var b1 = UI.el('<button class="btn primary wide" id="btn-play">' + (opp ? '开始比赛' : '继续') + '</button>');
    var b2 = UI.el('<button class="btn wide" id="btn-skip">快速模拟本轮</button>');
    var b3 = UI.el('<button class="btn wide" id="btn-shop">投资与团队</button>');
    mb.appendChild(b1); mb.appendChild(b2); mb.appendChild(b3);
    b1.addEventListener('click', function () { UI.beforeMatch(); });
    b2.addEventListener('click', function () { UI.quickSim(); });
    b3.addEventListener('click', function () { UI.shopModal(); });

    node.querySelector('#acts').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || b.disabled) return;
      if (St.S.weekDone) { UI.toast('本周已经安排过了', 'warn'); return; }
      var key = b.getAttribute('data-act');
      var r = St.doActivity(key);
      St.S.weekDone = true;
      St.S.weekLog = St.S.player.name + '：' + (r.texts.length ? r.texts.join(' ｜ ') : BL.ACT_MAP[key].name);
      St.save();
      UI.toast(r.texts.length ? r.texts.join('  ') : BL.ACT_MAP[key].name, '');
      UI.render();
    });

    return node;
  };

  /* 商店 */
  UI.shopModal = function () {
    var p = St.S.player;
    var body = ['<p>资金 <b class="yellow">¥' + p.money.toLocaleString('en-US') + '</b>　这些投资永久生效。</p>'];
    BL.SHOP.forEach(function (it) {
      var owned = !!p.upgrades[it.key];
      body.push('<div class="cardrow' + (owned ? ' sel' : '') + '"><div class="t"><b>' + it.name + '</b><small>' + it.desc + '</small></div>' +
        '<span class="pill ' + (owned ? 'g' : (p.money >= it.price ? 'y' : 'r')) + '">' + (owned ? '已拥有' : '¥' + it.price.toLocaleString('en-US')) + '</span>' +
        '<button class="btn sm" data-buy="' + it.key + '"' + (owned || p.money < it.price ? ' disabled' : '') + '>购买</button></div>');
    });
    UI.modal({ title: '投资与团队', body: body.join(''), keep: true, actions: [
      { label: '关闭', keepOpen: true, onClick: function () { UI.closeModal(); } }
    ] });
    var layer = document.getElementById('modal-layer');
    layer.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-buy');
        if (St.buy(k)) {
          St.save();
          UI.toast('购买成功！', '');
          UI.closeModal();
          UI.shopModal();
          UI.topbar();
        } else UI.toast('资金不足', 'bad');
      });
    });
  };

  /* 事件弹窗 */
  UI.eventModal = function (ev, after) {
    var body = ['<p>' + UI.esc(ev.text) + '</p>'];
    var node = UI.el('<div>' + body.join('') + '</div>');
    ev.options.forEach(function (o, i) {
      var d = UI.el('<div class="choice"><b>' + UI.esc(o.label) + '</b><p>' + UI.esc(o.desc) + '</p></div>');
      d.addEventListener('click', function () {
        var lines = St.applyEvent(ev, i);
        St.save();
        UI.closeModal();
        UI.modal({
          title: ev.title, body: '<p>' + UI.esc(o.result) + '</p><div class="fx">' + lines.join('\n') + '</div>',
          actions: [{ label: '继续', cls: 'primary', onClick: after }]
        });
      });
      node.appendChild(d);
    });
    UI.modal({ title: ev.title, body: node.innerHTML, actions: [] });
    /* 重新绑定（因为 innerHTML 丢失了监听） */
    var layer = document.getElementById('modal-layer');
    var choices = layer.querySelectorAll('.choice');
    ev.options.forEach(function (o, i) {
      if (!choices[i]) return;
      choices[i].addEventListener('click', function () {
        var lines = St.applyEvent(ev, i);
        St.save();
        UI.closeModal();
        UI.modal({
          title: ev.title, body: '<p>' + UI.esc(o.result) + '</p><div class="fx">' + lines.join('\n') + '</div>',
          actions: [{ label: '继续', cls: 'primary', onClick: after }]
        });
      });
    });
    /* 隐藏默认按钮 */
    var acts = document.getElementById('modal-actions');
    if (acts) acts.innerHTML = '<div class="dim2 center">选择一个选项</div>';
  };

  /* 进入比赛前：可能触发事件 */
  UI.beforeMatch = function () {
    var s = St.S;
    if (!s.weekDone && !s.eventPending) {
      /* 没安排活动也可以直接比赛，但会错过成长 */
      s.weekDone = true;
      s.weekLog = '本周没有安排额外活动，直接投入比赛。';
    }
    var roll = Math.random();
    var need = (s.week - (s.lastEventWeek || 0)) >= 4;
    if (need || roll < 0.32) {
      var ev = St.rollEvent();
      if (ev) {
        s.lastEventWeek = s.week;
        UI.eventModal(ev, function () {
          St.save();
          UI.go('prematch');
        });
        return;
      }
    }
    UI.go('prematch');
  };

  /* 快速模拟整轮 */
  UI.quickSim = function () {
    St.S.weekDone = true;
    UI.go('prematch', { quick: true });
  };

})(window.BL);
