/* ============================================================
 *  data.js — 静态数据：属性 / 位置 / 俱乐部 / 训练 / 事件 / 商店
 * ============================================================ */
window.BL = window.BL || {};
(function (BL) {
  'use strict';

  /* ---------------- 版本 ----------------
     改版本号请用 node tools/bump.js <版本号> "说明"，它会同步更新：
     src/data.js 的 BL.VERSION、version.json、index.html 里所有 ?v= 缓存击穿参数 */
  BL.VERSION = {
    num: '0.5.0',
    date: '2026-09-11',
    note: '版本号显示 + 新版本检测；含渲染 2x、移动端适配、刷新崩溃修复'
  };

  /* ---------------- 属性 ---------------- */
  BL.ATTRS = [
    { key: 'shooting',  name: '射门', abbr: 'SHT', color: '#ff6b6b', tip: '射门容错更大，门将更难扑救' },
    { key: 'passing',   name: '传球', abbr: 'PAS', color: '#4ecdc4', tip: '传球提前量更准，路线更难被断' },
    { key: 'dribbling', name: '盘带', abbr: 'DRI', color: '#f5c542', tip: '盘带时对手抢断范围更小' },
    { key: 'defending', name: '防守', abbr: 'DEF', color: '#a78bfa', tip: '防守时拦截范围更大' },
    { key: 'pace',      name: '速度', abbr: 'PAC', color: '#4d9de0', tip: '划动时间更充裕，跑动更快' },
    { key: 'physical',  name: '体能', abbr: 'PHY', color: '#f97316', tip: '体力消耗更慢，对抗更强' }
  ];
  BL.ATTR_MAP = {};
  BL.ATTRS.forEach(function (a) { BL.ATTR_MAP[a.key] = a; });

  /* ---------------- 位置 ---------------- */
  BL.POSITIONS = {
    ST: { name: '中锋',   abbr: 'ST',  scene: { shoot: 4.0, pass: 1.2, dribble: 1.8, defend: 0.3 },
          ovr: { shooting: .28, passing: .08, dribbling: .16, defending: .03, pace: .20, physical: .25 } },
    W:  { name: '边锋',   abbr: 'LW',  scene: { shoot: 2.2, pass: 2.2, dribble: 3.6, defend: 0.5 },
          ovr: { shooting: .17, passing: .14, dribbling: .27, defending: .04, pace: .26, physical: .12 } },
    AM: { name: '前腰',   abbr: 'AM',  scene: { shoot: 1.8, pass: 3.6, dribble: 2.8, defend: 0.7 },
          ovr: { shooting: .16, passing: .28, dribbling: .22, defending: .04, pace: .15, physical: .15 } },
    CM: { name: '中前卫', abbr: 'CM',  scene: { shoot: 1.2, pass: 4.0, dribble: 1.6, defend: 2.0 },
          ovr: { shooting: .10, passing: .30, dribbling: .13, defending: .14, pace: .11, physical: .22 } },
    DM: { name: '后腰',   abbr: 'DM',  scene: { shoot: 0.7, pass: 2.4, dribble: 0.8, defend: 4.0 },
          ovr: { shooting: .06, passing: .20, dribbling: .07, defending: .30, pace: .10, physical: .27 } },
    FB: { name: '边后卫', abbr: 'LB',  scene: { shoot: 0.4, pass: 2.4, dribble: 1.4, defend: 3.6 },
          ovr: { shooting: .04, passing: .18, dribbling: .12, defending: .26, pace: .25, physical: .15 } },
    CB: { name: '中后卫', abbr: 'CB',  scene: { shoot: 0.2, pass: 1.2, dribble: 0.4, defend: 4.8 },
          ovr: { shooting: .02, passing: .10, dribbling: .04, defending: .38, pace: .16, physical: .30 } }
  };
  BL.POS_KEYS = ['ST', 'W', 'AM', 'CM', 'DM', 'FB', 'CB'];

  /* ---------------- 俱乐部 ---------------- */
  BL.CLUBS = [
    /* 顶级联赛 */
    { id: 'real',   name: '皇家竞技',     tier: 1, str: 90, fac: 5, wage: 280000, kit: ['#f2f4f8', '#2b3a67'] },
    { id: 'city',   name: '蓝月城',       tier: 1, str: 88, fac: 5, wage: 265000, kit: ['#6cc4f5', '#1b2a4a'] },
    { id: 'cata',   name: '加泰联',       tier: 1, str: 87, fac: 5, wage: 250000, kit: ['#a63a4e', '#22304a'] },
    { id: 'bavar',  name: '巴伐利亚红星', tier: 1, str: 86, fac: 5, wage: 240000, kit: ['#d63b3b', '#f2f4f8'] },
    { id: 'paris',  name: '巴黎之光',     tier: 1, str: 85, fac: 4, wage: 235000, kit: ['#28336b', '#e04b64'] },
    { id: 'milan',  name: '米兰之鹰',     tier: 1, str: 83, fac: 4, wage: 205000, kit: ['#c0392b', '#141a22'] },
    /* 甲级联赛 */
    { id: 'ajax',   name: '阿姆斯特丹青年', tier: 2, str: 76, fac: 4, wage: 95000, kit: ['#e04b4b', '#f2f4f8'] },
    { id: 'lyon',   name: '里昂雄狮',     tier: 2, str: 74, fac: 4, wage: 82000, kit: ['#2b6ecb', '#f2f4f8'] },
    { id: 'lisbon', name: '里斯本航海家', tier: 2, str: 73, fac: 3, wage: 72000, kit: ['#2f9e5a', '#f2f4f8'] },
    { id: 'turin',  name: '都灵公牛',     tier: 2, str: 72, fac: 3, wage: 66000, kit: ['#7a3a2a', '#f2f4f8'] },
    { id: 'sevil',  name: '塞维利亚火焰', tier: 2, str: 71, fac: 3, wage: 60000, kit: ['#e8622a', '#f7f3e8'] },
    /* 乙级联赛（起步） */
    { id: 'schalk', name: '沙尔克矿工',   tier: 3, str: 64, fac: 3, wage: 24000, kit: ['#2a5bd7', '#f2f4f8'] },
    { id: 'gron',   name: '格罗宁根小城', tier: 3, str: 62, fac: 3, wage: 19000, kit: ['#3aa655', '#f2f4f8'] },
    { id: 'braga',  name: '布拉加青训',   tier: 3, str: 60, fac: 2, wage: 15000, kit: ['#b02a3a', '#f2f4f8'] },
    { id: 'gijon',  name: '希洪海岸',     tier: 3, str: 58, fac: 2, wage: 12000, kit: ['#c8452f', '#f2f4f8'] },
    { id: 'ostra',  name: '奥斯特拉瓦',   tier: 3, str: 56, fac: 2, wage: 10000, kit: ['#2f4f8f', '#e8e2d0'] }
  ];
  BL.CLUB_MAP = {};
  BL.CLUBS.forEach(function (c) { BL.CLUB_MAP[c.id] = c; });
  BL.TIER_NAME = { 1: '世界顶级联赛', 2: '欧洲甲级联赛', 3: '本土乙级联赛' };
  BL.TIER_BASE = { 1: 82, 2: 71, 3: 58 };

  BL.FILLER_NAMES = [
    '北境联', '铁砧城', '海鸥城', '红杉谷', '白石镇', '灰狼城', '南方之星', '蓝港联',
    '圣马可', '绿丘联', '铁桥镇', '雾都流浪者', '银矿城', '橡树镇', '黑池联', '金鹿城',
    '风车镇', '老港口', '山鹰城', '赤岩堡', '雪线镇', '铜锣湾', '长堤联', '猎户座'
  ];
  BL.FILLER_KITS = [
    ['#e8e2d0', '#2b3a67'], ['#3aa655', '#141a22'], ['#f5c542', '#1b2a4a'],
    ['#a78bfa', '#141a22'], ['#4d9de0', '#f2f4f8'], ['#e05555', '#141a22'],
    ['#f97316', '#141a22'], ['#2f9e8f', '#f2f4f8'], ['#c4b1ff', '#2b3a67'],
    ['#dcdcdc', '#c0392b'], ['#7f8fa8', '#141a22'], ['#4a6b3a', '#f2f4f8']
  ];

  /* ---------------- 每周活动 ---------------- */
  BL.ACTIVITIES = [
    { key: 'shooting',  name: '射门特训', icon: '&#127919;', attr: 'shooting',  cond: 14, desc: '对着空门反复练习，提升射门' },
    { key: 'passing',   name: '传球特训', icon: '&#127939;', attr: 'passing',   cond: 12, desc: '墙式配合与长传练习，提升传球' },
    { key: 'dribbling', name: '盘带特训', icon: '&#128168;', attr: 'dribbling', cond: 14, desc: '绕杆与变向训练，提升盘带' },
    { key: 'defending', name: '防守特训', icon: '&#128737;', attr: 'defending', cond: 14, desc: '卡位与铲抢演练，提升防守' },
    { key: 'pace',      name: '速度冲刺', icon: '&#9889;',   attr: 'pace',      cond: 18, desc: '折返跑与短距离冲刺，提升速度' },
    { key: 'physical',  name: '体能强化', icon: '&#127947;', attr: 'physical',  cond: 16, desc: '力量与耐力训练，提升体能' },
    { key: 'rest',      name: '休息调整', icon: '&#128164;', attr: null,        cond: -34, desc: '在家休整，大幅恢复体力与士气' },
    { key: 'social',    name: '队友聚会', icon: '&#127867;', attr: null,        cond: 8,  desc: '融入更衣室，提升队内关系' },
    { key: 'media',     name: '商业活动', icon: '&#128176;', attr: null,        cond: 12, desc: '拍广告、上节目，赚钱与声望' }
  ];
  BL.ACT_MAP = {};
  BL.ACTIVITIES.forEach(function (a) { BL.ACT_MAP[a.key] = a; });

  /* ---------------- 商店 ---------------- */
  BL.SHOP = [
    { key: 'coach',   name: '私人技术教练', desc: '永久：训练效果 +30%',        price: 260000 },
    { key: 'physio',  name: '专属康复师',   desc: '永久：体力恢复 +40%',        price: 320000 },
    { key: 'pr',      name: '公关团队',     desc: '永久：声望增长 +50%',        price: 420000 },
    { key: 'boots',   name: '定制战靴',     desc: '永久：划动时间 +12%',        price: 180000 }
  ];

  /* ---------------- 决策事件 ---------------- */
  /* fx: 属性增减 / relations 队内关系 / morale 士气 / condition 体力 / money 金钱 / reputation 声望 / form 状态 */
  BL.EVENTS = [
    {
      id: 'coach_position', title: '主教练的改造计划', once: true, minWeek: 3,
      text: '训练结束后，主教练把你叫到一边：「球队现在缺人，我想让你改踢一个新位置，你愿意吗？」',
      options: [
        { label: '听从安排', desc: '服从教练，队内关系提升，但短期内不适应', fx: { relations: 8, form: -4, morale: 2 }, result: '你点头答应。教练拍了拍你的肩膀：「好小子。」' },
        { label: '坚持自己的位置', desc: '保持本色，士气提升，教练略有不满', fx: { morale: 6, relations: -6 }, result: '「我只想踢自己最擅长的位置。」教练皱眉离开了。' },
        { label: '主动加练适应', desc: '体力消耗大，但能力成长明显', fx: { condition: -18, relations: 5, physical: 1, pace: 1 }, result: '你每天加练两小时，一周后连教练都惊讶了。' }
      ]
    },
    {
      id: 'captain_fight', title: '更衣室风波', minWeek: 5,
      text: '队内核心球员在训练中公开批评你「太独」。更衣室的气氛有些紧张。',
      options: [
        { label: '当面道歉', desc: '放低姿态，关系提升', fx: { relations: 10, morale: -4 }, result: '你主动握手：「下次我会多看你。」气氛缓和了。' },
        { label: '用表现回应', desc: '士气与射门提升，但关系下降', fx: { shooting: 2, morale: 8, relations: -8 }, result: '你什么也没说，只是在训练赛里进了四个球。' }
      ]
    },
    {
      id: 'nightclub', title: '赛后夜生活', minWeek: 6,
      text: '队友邀请你去城里最火的夜店庆祝胜利，明天早上还有恢复训练。',
      options: [
        { label: '一起去', desc: '关系大幅提升，但体力与状态下滑', fx: { relations: 14, condition: -22, form: -5, morale: 6 }, result: '你们玩到凌晨三点。第二天的训练你几乎跑不动。' },
        { label: '回家睡觉', desc: '体力恢复，队友觉得你有点无趣', fx: { condition: 16, form: 4, relations: -5 }, result: '你早早入睡。队友在群里发了照片，没带你。' }
      ]
    },
    {
      id: 'sponsor', title: '赞助商邀约', minWeek: 4,
      text: '一家运动品牌希望你出席商业活动，报酬丰厚，但会占用两天训练时间。',
      options: [
        { label: '接受代言', desc: '获得金钱与声望', fx: { money: 120000, reputation: 6, condition: -12, form: -3 }, result: '广告拍得很顺利，你的脸出现在了市中心的广告牌上。' },
        { label: '专注训练', desc: '拒绝金钱，专注成长', fx: { relations: 4, morale: 4, shooting: 1, passing: 1 }, result: '你婉拒了邀请。教练知道后，把你的名字写进了首发名单。' }
      ]
    },
    {
      id: 'injury_choice', title: '带伤出战', minWeek: 8, needConditionBelow: 55,
      text: '你的大腿有些不适，但下场是关键的比赛。队医建议你休息两周。',
      options: [
        { label: '打封闭上场', desc: '短期状态爆棚，但伤病风险大增', fx: { form: 12, morale: 5, injuryRisk: 35, condition: -18 }, result: '你打了一针封闭：「这场比赛我必须上。」' },
        { label: '听队医的话', desc: '安全恢复，但错过比赛', fx: { condition: 26, form: -6, relations: -3 }, result: '你坐上了看台。球队赢了，但你心里很不是滋味。' }
      ]
    },
    {
      id: 'fan_letter', title: '小球迷的信', minWeek: 4,
      text: '一个生病的小球迷给你寄来一封信，说你是他的偶像，希望你能去看他。',
      options: [
        { label: '去医院探望', desc: '士气与声望提升', fx: { morale: 12, reputation: 5, condition: -6 }, result: '你在病房里陪他聊了一个下午，还送了他一件签名球衣。' },
        { label: '寄一件球衣', desc: '简单处理，专注训练', fx: { reputation: 2, shooting: 1 }, result: '你寄出了球衣，然后继续回到训练场。' }
      ]
    },
    {
      id: 'agent_offer', title: '经纪人的提议', minWeek: 10,
      text: '你的经纪人带来消息：有更大的俱乐部在关注你，他希望你现在就公开表达转会意愿。',
      options: [
        { label: '公开施压', desc: '声望大涨，但队内关系暴跌', fx: { reputation: 14, relations: -16, morale: -4 }, result: '你的采访引爆了媒体，球迷在训练基地外挂起了横幅。' },
        { label: '保持沉默', desc: '安心踢球，关系稳定', fx: { relations: 6, morale: 4 }, result: '「我现在只想为这支球队踢球。」这句话让主教练很满意。' }
      ]
    },
    {
      id: 'personal_coach', title: '传奇前辈的邀请', minWeek: 12,
      text: '一位退役的传奇球星愿意在休赛期带你训练，但你要放弃整个假期。',
      options: [
        { label: '接受特训', desc: '大幅成长，体力透支', fx: { shooting: 2, passing: 2, dribbling: 2, condition: -30, morale: -5 }, result: '两个月的魔鬼训练，你脱了一层皮，但脚下感觉完全不同了。' },
        { label: '好好休息', desc: '恢复为主', fx: { condition: 30, morale: 8 }, result: '你在海滩上度过了一个惬意的假期。' }
      ]
    },
    {
      id: 'derby_talk', title: '德比前的采访', minWeek: 14,
      text: '记者问你： 「对手说你是被高估的球员，你怎么回应？」',
      options: [
        { label: '放狠话', desc: '士气与声望提升，对手更强硬', fx: { morale: 10, reputation: 6, form: 4 }, result: '「那就让他们在球场上看看。」明天报纸的头版都是你。' },
        { label: '低调回应', desc: '专注比赛', fx: { form: 6, morale: 2 }, result: '「我只专注于比赛本身。」你冷静地离开了采访区。' }
      ]
    },
    {
      id: 'charity', title: '社区公益活动', minWeek: 9,
      text: '俱乐部安排你去社区教孩子们踢球，但这会占用你半天的恢复时间。',
      options: [
        { label: '认真参与', desc: '声望与士气提升', fx: { reputation: 6, morale: 9, condition: -10 }, result: '孩子们围着你喊你的名字，你笑得像个孩子。' },
        { label: '请假不去', desc: '专注恢复', fx: { condition: 14, reputation: -3 }, result: '你在恢复室度过了一个安静的下午。' }
      ]
    },
    {
      id: 'video_study', title: '录像分析课', minWeek: 6,
      text: '助教邀请你一起分析对手的防守录像，需要占用晚上休息时间。',
      options: [
        { label: '认真研究', desc: '意识与传球提升，体力略降', fx: { passing: 2, condition: -10, form: 3 }, result: '你发现了对手右后卫的致命弱点，并记在了本子上。' },
        { label: '早点睡觉', desc: '恢复体力', fx: { condition: 12 }, result: '你选择了休息，明天再练。' }
      ]
    },
    {
      id: 'contract_talk', title: '续约谈判', minWeek: 16,
      text: '俱乐部希望与你续约，经纪人建议你索要更高的薪水。',
      options: [
        { label: '要求涨薪', desc: '薪水提升，关系略降', fx: { money: 200000, relations: -5, morale: 5 }, result: '谈判持续了很久，最终俱乐部同意了你的条件。' },
        { label: '痛快签字', desc: '关系与士气提升', fx: { relations: 12, morale: 8, reputation: 2 }, result: '「我在这里很开心。」你在合同上签了字。' }
      ]
    }
  ];

  /* ---------------- 荣誉 ---------------- */
  BL.HONOR_INFO = {
    'league_title':  { name: '联赛冠军',     color: '#f5c542', icon: '&#127942;' },
    'top_scorer':    { name: '联赛最佳射手', color: '#ff6b6b', icon: '&#9917;' },
    'top_assist':    { name: '联赛助攻王',   color: '#4ecdc4', icon: '&#127919;' },
    'league_mvp':    { name: '联赛最佳球员', color: '#a78bfa', icon: '&#11088;' },
    'best_young':    { name: '最佳新人',     color: '#57cc72', icon: '&#127793;' },
    'ballon_dor':    { name: '世界足球先生', color: '#ffd700', icon: '&#128142;' },
    'club_potm':     { name: '俱乐部赛季最佳', color: '#4d9de0', icon: '&#127894;' }
  };

  /* ---------------- 提示 ---------------- */
  BL.TIPS = [
    '划动轨迹时，起点要靠近球，终点要落在目标圈里。',
    '轨迹越接近提示的虚线，判定越好。',
    '能力值越高，容错圈越大、划动时间越充裕。',
    '队内关系越好，队友越愿意把球交给你。',
    '体力过低会导致表现下滑，甚至受伤。',
    '年轻球员的成长速度远快于老将。'
  ];

})(window.BL);
