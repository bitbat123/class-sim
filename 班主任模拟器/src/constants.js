// ============ 全局常量与可调参数（所有数值集中在此，便于调整） ============

// 评分等级（从低到高）
export const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSSS', 'SSSS+', 'US'];

// 每个等级颜色：红 → 橙 → 黄 → 绿 → 青 → 蓝 → 紫 → 金
export const GRADE_COLORS = {
  F: '#ef4444',
  E: '#f97316',
  D: '#f59e0b',
  C: '#eab308',
  B: '#84cc16',
  A: '#22c55e',
  S: '#14b8a6',
  SS: '#06b6d4',
  SSS: '#3b82f6',
  SSSS: '#8b5cf6',
  'SSSS+': '#a855f7',
  US: '#fbbf24',
};

// 熟练度 0~100，每 MASTERY_PER_GRADE 点对应一个等级（0~7 → F, ..., 88+ → US）
export const MASTERY_PER_GRADE = 8;

// 9 个科目；满分：语数英 150，其余 100
export const SUBJECTS = [
  { key: 'chinese', name: '语文', short: '语', max: 150 },
  { key: 'math', name: '数学', short: '数', max: 150 },
  { key: 'english', name: '英语', short: '英', max: 150 },
  { key: 'physics', name: '物理', short: '物', max: 100 },
  { key: 'chemistry', name: '化学', short: '化', max: 100 },
  { key: 'biology', name: '生物', short: '生', max: 100 },
  { key: 'history', name: '历史', short: '史', max: 100 },
  { key: 'geography', name: '地理', short: '地', max: 100 },
  { key: 'politics', name: '政治', short: '政', max: 100 },
];

// 学制
export const SYSTEMS = {
  '63': { name: '六三制', years: ['初一', '初二', '初三', '高一', '高二', '高三'] },
  '54': { name: '五四制', years: ['预初', '初一', '初二', '初三', '高一', '高二', '高三'] },
};

// 难度：开局班费 / 每周班费收入（x 为学生人数）
export const DIFFICULTY = {
  novice: {
    name: '新手',
    startLabel: '10000 + 1000x',
    incomeLabel: '800 + 50x',
    start: (x) => 10000 + 1000 * x,
    income: (x) => 800 + 50 * x,
  },
  normal: {
    name: '普通',
    startLabel: '6000 + 600x',
    incomeLabel: '500 + 20x',
    start: (x) => 6000 + 600 * x,
    income: (x) => 500 + 20 * x,
  },
  hard: {
    name: '困难',
    startLabel: '3000 + 100x',
    incomeLabel: '350 + 15x',
    start: (x) => 3000 + 100 * x,
    income: (x) => 350 + 15 * x,
  },
  hell: {
    name: '地狱',
    startLabel: '1000 + 10x',
    incomeLabel: '250 + 10x',
    start: (x) => 1000 + 10 * x,
    income: (x) => 250 + 10 * x,
  },
};

// 学习行动：cost = base * x * y（x=选中学生数，y=选中科目数）
// gain：每名学生每科的熟练度增幅（压力倍率生效前）；pressure：压力增加（百分点）
export const STUDY_ACTIONS = [
  { id: 'quiz', name: '小测验', icon: '📝', base: 100, gain: 4, pressure: 5, exam: true, desc: '小幅提升；同时触发一次考试（所选科目）' },
  { id: 'exam', name: '大考', icon: '📋', base: 300, gain: 12, pressure: 15, exam: true, slots: 2, desc: '明显提升；同时触发一次考试（所选科目）' },
  { id: 'homework', name: '做作业', icon: '✏️', base: 10, gain: 1, pressure: 2, desc: '很小提升，几乎不增压' },
  { id: 'tutor', name: '课后辅导', icon: '🧑‍🏫', base: 200, gain: 6, pressure: 8, desc: '中等提升' },
  { id: 'lecture', name: '名师讲座', icon: '🎤', base: 500, gain: 10, pressure: 12, desc: '较大提升' },
  { id: 'notes', name: '错题本整理', icon: '📒', base: 50, gain: 3, pressure: 3, desc: '小幅提升' },
  { id: 'discuss', name: '小组讨论', icon: '💬', base: 30, gain: 3, pressure: 4, desc: '小幅提升' },
  { id: 'oneone', name: '一对一答疑', icon: '🙋', base: 150, gain: 7, pressure: 6, desc: '中等提升' },
  { id: 'mock', name: '模拟考试', icon: '🧪', base: 400, gain: 14, pressure: 20, slots: 2, desc: '大幅提升，压力也大' },
  { id: 'self', name: '自主学习周', icon: '🌱', base: 80, gain: 3, pressure: 1, desc: '小幅提升，几乎不增压' },
  { id: 'morning', name: '早读打卡', icon: '🌅', base: 20, gain: 1.5, pressure: 1, desc: '每天早读，少量提升，几乎不增压' },
  { id: 'contest', name: '竞赛培训', icon: '🏅', base: 600, gain: 16, pressure: 25, slots: 2, desc: '高强度培训，大幅提升，压力很大' },
  { id: 'mindmap', name: '思维导图工坊', icon: '🗺️', base: 120, gain: 5, pressure: 3, desc: '理清知识结构，中小幅提升' },
  { id: 'homeschool', name: '家校联动补课', icon: '🏠', base: 250, gain: 8, pressure: 10, desc: '家长配合补课，中等提升' },
  { id: 'freeread', name: '课间自由阅读', icon: '📖', base: 0, gain: 2, pressure: 0, desc: '免费，小幅提升，不增压' },
];

// 减压行动：cost = base * x（x=选中学生数），delta 为压力减少（百分点）
export const RELIEF_ACTIONS = [
  { id: 'meeting', name: '班会活动', icon: '🎈', base: 200, delta: 15, desc: '选中学生压力 -15%' },
  { id: 'counsel', name: '心理辅导', icon: '🧘', base: 150, delta: 10, desc: '选中学生压力 -10%' },
  { id: 'trip', name: '春游/秋游', icon: '🏞️', base: 500, delta: 30, desc: '选中学生压力 -30%' },
  { id: 'chat', name: '单独谈心', icon: '🤝', base: 80, delta: 8, desc: '选中学生压力 -8%' },
  { id: 'music', name: '音乐放松', icon: '🎵', base: 60, delta: 6, desc: '选中学生压力 -6%' },
  { id: 'sports', name: '体育运动会', icon: '⚽', base: 350, delta: 20, desc: '选中学生压力 -20%' },
  { id: 'camp', name: '团建露营', icon: '⛺', base: 800, delta: 40, desc: '选中学生压力 -40%，花费较高' },
  { id: 'park', name: '公园散步', icon: '🌳', base: 0, delta: 5, desc: '免费，选中学生压力 -5%' },
];

// 学生随机特质（每人 0~2 个，好坏混合）
// gain：学习增幅倍率；pressure：压力增加倍率
export const TRAITS = [
  { id: 'genius', name: '天才', icon: '🧠', good: true, gain: 1.4, pressure: 1.0, desc: '学习效率高，增幅 ×1.4' },
  { id: 'hardwork', name: '勤奋', icon: '💪', good: true, gain: 1.2, pressure: 1.1, desc: '努力但略有压力，增幅 ×1.2' },
  { id: 'calm', name: '心态好', icon: '😌', good: true, gain: 1.0, pressure: 0.6, desc: '抗压能力强，压力增幅 ×0.6' },
  { id: 'social', name: '社牛', icon: '🎉', good: true, gain: 1.1, pressure: 0.8, desc: '人际好，压力增幅 ×0.8' },
  { id: 'lazy', name: '懒散', icon: '😴', good: false, gain: 0.7, pressure: 1.0, desc: '不爱学习，增幅 ×0.7' },
  { id: 'anxious', name: '焦虑', icon: '😰', good: false, gain: 1.0, pressure: 1.6, desc: '容易焦虑，压力增幅 ×1.6' },
  { id: 'fragile', name: '体弱', icon: '🤒', good: false, gain: 0.9, pressure: 1.2, desc: '身体弱，增幅 ×0.9、压力 ×1.2' },
  { id: 'rebel', name: '叛逆', icon: '🔥', good: false, gain: 0.8, pressure: 1.3, desc: '不服管教，增幅 ×0.8、压力 ×1.3' },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

// 学习收益递减：熟练度越高，每次增幅越小。mult = max(floor, 1 - mastery/ cap)
export const DIMINISHING = { cap: 110, floor: 0.12 };

// 学科天赋：每人每科在 [min, max] 间随机
export const APTITUDE = { min: 0.5, max: 1.3 };
// 每次学习：每人每科的运气波动（每次都重新掷骰），范围更宽，不稳定性更高
export const LUCK = { min: 0.4, max: 1.6 };
// 全局学习系数：所有学习行动的基础增幅统一打折（原来过快）
export const STUDY_SCALE = 0.45;

// 生病：持续周数、每周能力下降、生病时学习效果倍率；治疗花费与治疗后剩余周数
export const SICK = {
  defaultWeeks: 4,
  weeklyDecline: 2,
  gainMult: 0.5,
  treatWeeks: 1,
  cost: 500,
};

// 医疗行动（按选中的病号人数收费）
export const MEDICAL_ACTIONS = [
  { id: 'treat', name: '看病治疗', icon: '🏥', base: SICK.cost, desc: `每名病号 ¥${SICK.cost}，病程缩短至 ${SICK.treatWeeks} 周` },
];

// 压力阈值与倍率
export const PRESSURE = {
  decayPerWeek: 10,        // 每周自然减少（百分点）
  halfThreshold: 50,       // >50 效果衰减
  stallThreshold: 100,     // >100 不再进步，每周退步
  collapseThreshold: 250,  // >250 崩溃
  decayMultiplier: 0.7,    // 50%~100% 区间的倍率
  regressPerWeek: 1,       // 压力>100 每周所有科目熟练度 -1
};

// 周期与考试
export const CALENDAR = {
  weeksPerSemester: 20,
  monthlyWeeks: [4, 8, 12, 16],      // 每月小测（语数英）
  midtermWeek: 10,                   // 期中（全部 9 科）
  finalWeek: 20,                     // 期末（全部 9 科）
  schoolMultiplier: 20,              // 全校人数 = x * 20
  actionsPerWeek: 3,                 // 每周学习/减压行动次数
  eventChance: 0.65,                 // 每周至少发生一件随机事件的概率（原 0.35）
  extraEventChance: 0.35,            // 已发生事件后，再追加一件的概率（可连环发生）
  maxEventsPerWeek: 3,               // 每周最多随机事件数
};

// 成绩颜色（按得分率，百分比 0~100 为阈值）——100 分制科目（物/化/生/史/地/政）
export const SCORE_BANDS = [
  { max: 60, color: '#ef4444', label: '<60' },
  { max: 75, color: '#f97316', label: '60–75' },
  { max: 85, color: '#eab308', label: '75–85' },
  { max: 95, color: '#22c55e', label: '85–95' },
  { max: 101, color: '#8b5cf6', label: '95+' },
];

// 150 分制科目（语/数/英）：按得分率换算成分数段
// 对应：<90、90–112、112–127、127–142、142+（与 100 分制同比例）
export const SCORE_BANDS_150 = [
  { max: 90, color: '#ef4444', label: '<90' },
  { max: 112.5, color: '#f97316', label: '90–112' },
  { max: 127.5, color: '#eab308', label: '112–127' },
  { max: 142.5, color: '#22c55e', label: '127–142' },
  { max: 151, color: '#8b5cf6', label: '142+' },
];
