// ============ 游戏核心逻辑（纯函数，无 React 依赖；前端与联机服务端共用） ============
import {
  GRADES, MASTERY_PER_GRADE, SUBJECTS, SYSTEMS, DIFFICULTY,
  STUDY_ACTIONS, RELIEF_ACTIONS, PRESSURE, CALENDAR,
  TRAITS, TRAIT_BY_ID, APTITUDE, LUCK, DIMINISHING, STUDY_SCALE, SICK,
  MODES, TIME_SCALE, MORALE, TEACHER_NOTES, GAOKAO, GAOKAO_LUCK,
} from './constants.js';
import { GOAL_POOL, GOAL_BY_ID, ACHIEVEMENTS } from './goals.js';

const SUBJECT_BY_KEY = Object.fromEntries(SUBJECTS.map((s) => [s.key, s]));
const ALL_KEYS = SUBJECTS.map((s) => s.key);
const CORE_KEYS = ['chinese', 'math', 'english'];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const clampMorale = (v) => clamp(v, 0, 100);

/** 熟练度(0~100) → 等级索引 */
export const gradeIndex = (mastery) =>
  clamp(Math.floor(mastery / MASTERY_PER_GRADE), 0, GRADES.length - 1);
export const gradeOf = (mastery) => GRADES[gradeIndex(mastery)];

/** 压力倍率：≤50 → 1.0；50~100 → 0.7；>100 → 0（不进步） */
export function pressureMultiplier(p) {
  if (p > PRESSURE.stallThreshold) return 0;
  if (p > PRESSURE.halfThreshold) return PRESSURE.decayMultiplier;
  return 1;
}

/** 学习行动费用 = base * x * y */
export const studyCost = (action, x, y) => action.base * x * y;
/** 减压行动费用 = base * x */
export const reliefCost = (action, x) => action.base * x;

/** 可复现的伪随机数（mulberry32），由调用方传入 seed，保证 reducer 纯净 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function erf(x) {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t) *
      Math.exp(-ax * ax);
  return sign * y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/** 解析名字：支持逗号 / 换行分隔，不足补「学生N」 */
export function parseNames(text, x) {
  const raw = text
    .split(/[,，\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from({ length: x }, (_, i) => raw[i] || `学生${i + 1}`);
}

/** 学年/学期/周 文本 */
export function termLabel(state) {
  const semIdx = Math.floor(state.absWeek / CALENDAR.weeksPerSemester);
  const yearIdx = Math.floor(semIdx / 2);
  const term = semIdx % 2 === 0 ? '上' : '下';
  const year = state.years[Math.min(yearIdx, state.years.length - 1)];
  const wk = (state.absWeek % CALENDAR.weeksPerSemester) + 1;
  return `${year}${term}学期 第${wk}周`;
}

const blankMastery = () => Object.fromEntries(ALL_KEYS.map((k) => [k, 0]));

/** 时长模式：未知值回退到完整模式 */
export const resolveMode = (mode) => (MODES[mode] ? mode : 'full');
/** 当前局的学习时长倍率（旧存档没有 mode 字段时由 migrateState 补全） */
export const timeScaleOf = (state) => TIME_SCALE[resolveMode(state?.mode)] ?? 1;

const freshSemester = () => ({ sick: 0, collapses: 0, bestExamRate: 0 });

/** 抽取本学期的 2 个班级小目标（纯函数：只消耗传入的 rng） */
export function drawGoals(rng, count = 2) {
  const pool = [...GOAL_POOL];
  const ids = [];
  for (let i = 0; i < count && pool.length; i++) {
    ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  }
  return ids;
}

/** 生成一名学生：0~2 个随机特质（约 15% 无、60% 1 个、25% 2 个）+ 每科随机天赋 */
export function makeStudent(id, name, rng) {
  const roll = rng();
  const n = roll < 0.15 ? 0 : roll < 0.75 ? 1 : 2;
  const pool = [...TRAITS];
  const traits = [];
  for (let i = 0; i < n; i++) {
    traits.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  }
  const aptitude = Object.fromEntries(
    ALL_KEYS.map((k) => [k, +(APTITUDE.min + rng() * (APTITUDE.max - APTITUDE.min)).toFixed(2)]),
  );
  return { id, name, pressure: 0, mastery: blankMastery(), traits, aptitude, sickWeeks: 0 };
}

/** 特质叠加后的增幅/压力倍率 */
export function traitMods(traits) {
  return traits.reduce(
    (acc, id) => {
      const t = TRAIT_BY_ID[id];
      if (t) {
        acc.gain *= t.gain;
        acc.pressure *= t.pressure;
      }
      return acc;
    },
    { gain: 1, pressure: 1 },
  );
}

/**
 * 开局。mode 取 'full' | 'three' | 'one'（完整 / 三年 / 一年）。
 * 兼容旧参数 fast=true（等同于 mode='one'）。
 */
export function createGame({ system, difficulty, x, names, seed = 1, mode, fast = false }) {
  const diff = DIFFICULTY[difficulty];
  const m = resolveMode(mode ?? (fast ? 'one' : 'full'));
  // 时长模式只保留学制的最后 N 个学年（三年 = 高一~高三，一年 = 高三）
  const allYears = SYSTEMS[system].years;
  const cnt = MODES[m].yearCount;
  const years = cnt ? allYears.slice(-cnt) : allYears;
  const rng = mulberry32(seed);
  const students = names.map((name, id) => makeStudent(id, name, rng));
  return {
    system,
    difficulty,
    x,
    mode: m,
    years,
    totalWeeks: years.length * 2 * CALENDAR.weeksPerSemester,
    absWeek: 0,
    budget: diff.start(x),
    income: diff.income(x),
    actionsLeft: CALENDAR.actionsPerWeek,
    students,
    exams: [],
    log: [{ w: 0, type: 'info', text: '开学啦！班费已到账，祝你好运～' }],
    event: null,
    finished: false,
    morale: MORALE.start,
    goals: drawGoals(rng),
    goalResults: null,
    semester: freshSemester(),
    lastSemesterClean: null,
    achievements: [],
    note: null,
  };
}

/** 旧版存档（只有 fast 字段、没有 mode 等新字段）补全默认值 */
export function migrateState(s) {
  if (!s) return s;
  return {
    morale: MORALE.start,
    goals: [],
    goalResults: null,
    semester: freshSemester(),
    lastSemesterClean: null,
    achievements: [],
    note: null,
    ...s,
    mode: resolveMode(s.mode ?? (s.fast ? 'one' : 'full')),
  };
}

function cloneStudents(students) {
  return students.map((s) => ({ ...s, mastery: { ...s.mastery } }));
}

/**
 * 生成一场考试。分数 = 熟练度比例 ± 8% 随机波动。
 * 排名：班内排名 + 全校排名（以班级成绩均值/标准差估计正态分布，全校人数 = x * 20）。
 */
/**
 * 高考：在全部学年结束时执行一次。
 * 分数来源：该生 9 科熟练度比例 × 科目满分，再叠加 ±GAOKAO_LUCK 的随机波动。
 * 总分 750，按 GAOKAO.tiers 匹配录取学校。
 */
export function runGaokao(students, seed) {
  const rng = mulberry32(seed);
  const rows = students.map((st) => {
    const scores = {};
    let total = 0;
    for (const sub of SUBJECTS) {
      const base = st.mastery[sub.key] / 100;
      const rate = clamp(base + (rng() * 2 - 1) * GAOKAO_LUCK, 0, 1);
      const sc = Math.round(rate * sub.max);
      scores[sub.key] = sc;
      total += sc;
    }
    const tier = GAOKAO.tiers.find((t) => total >= t.min) || GAOKAO.tiers[GAOKAO.tiers.length - 1];
    return {
      id: st.id,
      name: st.name,
      scores,
      total,
      max: GAOKAO.total,
      school: tier.name,
      level: tier.level,
      color: tier.color,
      sick: st.sickWeeks > 0,
      traits: st.traits,
      pressure: st.pressure,
    };
  });

  // 班内排名
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  sorted.forEach((r, i) => { r.rank = i + 1; });

  const n = rows.length || 1;
  const avg = rows.reduce((a, r) => a + r.total, 0) / n;
  const best = sorted[0] || null;
  const topSchool = rows.reduce((acc, r) => {
    const idx = GAOKAO.tiers.findIndex((t) => t.name === r.school);
    return idx >= 0 && (acc === null || idx < acc.idx) ? { idx, name: r.school } : acc;
  }, null);

  return {
    at: 'graduation',
    rows: sorted,
    avg: Math.round(avg),
    best: best ? { name: best.name, total: best.total, school: best.school } : null,
    topSchool: topSchool ? topSchool.name : null,
    // 录取分布，用于汇总展示
    schoolCount: rows.reduce((acc, r) => {
      acc[r.school] = (acc[r.school] || 0) + 1;
      return acc;
    }, {}),
  };
}

export function makeExam(students, x, title, keys, seed, week) {
  const rng = mulberry32(seed);
  const rows = students.map((st) => {
    const scores = {};
    let total = 0;
    let max = 0;
    for (const k of keys) {
      const sub = SUBJECT_BY_KEY[k];
      const rate = clamp(st.mastery[k] / 100 + (rng() * 2 - 1) * 0.08, 0, 1);
      const sc = Math.round(rate * sub.max);
      scores[k] = sc;
      total += sc;
      max += sub.max;
    }
    return { id: st.id, name: st.name, scores, total, max, rate: max ? total / max : 0 };
  });

  const n = rows.length || 1;
  const mean = rows.reduce((a, r) => a + r.rate, 0) / n;
  const sd = Math.max(0.05, Math.sqrt(rows.reduce((a, r) => a + (r.rate - mean) ** 2, 0) / n));
  const schoolSize = x * CALENDAR.schoolMultiplier;

  rows.forEach((r) => {
    r.classRank = 1 + rows.filter((o) => o.rate > r.rate).length;
    const pct = normCdf((r.rate - mean) / sd);
    r.schoolRank = 1 + Math.round((1 - pct) * (schoolSize - 1));
  });

  return { id: `exam-${seed}`, week, title, keys, rows, mean, schoolSize };
}

/** 考试对士气的影响：班级均分率高 → 加分，低 → 扣分 */
const examMoraleDelta = (mean) =>
  mean >= MORALE.examHighRate ? MORALE.examHigh : mean <= MORALE.examLowRate ? MORALE.examLow : 0;

/** 崩溃判定：压力 > 250 → 所有科目归 F，压力重置为 0。返回本次崩溃人数 */
function applyCollapse(students, logs, week) {
  let count = 0;
  for (const st of students) {
    if (st.pressure > PRESSURE.collapseThreshold) {
      ALL_KEYS.forEach((k) => (st.mastery[k] = 0));
      st.pressure = 0;
      count += 1;
      logs.push({
        w: week,
        type: 'danger',
        text: `💥 ${st.name} 压力爆表（>${PRESSURE.collapseThreshold}%）崩溃了！所有科目归 F，压力清零`,
      });
    }
  }
  return count;
}

const pushLog = (state, text, type = 'info') => ({
  ...state,
  log: [...state.log, { w: state.absWeek + 1, type, text }].slice(-200),
});

function doStudy(state, { actionId, students: ids, subjects: keys, seed }) {
  const action = STUDY_ACTIONS.find((a) => a.id === actionId);
  const slots = action?.slots || 1;
  if (!action || state.actionsLeft < slots || !ids.length || !keys.length) return state;
  const cost = studyCost(action, ids.length, keys.length);
  if (cost > state.budget) {
    return pushLog(state, `班费不足：「${action.name}」需要 ${cost}，余额 ${state.budget}`, 'warn');
  }

  const rng = mulberry32(seed);
  const students = cloneStudents(state.students);
  const picked = new Set(ids);
  const timeMult = timeScaleOf(state); // 时长倍率：模式越短，每次学习增幅越大
  const gains = {}; // 每人本次总增幅，用于播报「进步最快/最慢」
  for (const st of students) {
    if (!picked.has(st.id)) continue;
    const mult = pressureMultiplier(st.pressure); // 使用行动前的压力计算倍率
    const mods = traitMods(st.traits);
    const sickMult = st.sickWeeks > 0 ? SICK.gainMult : 1; // 生病时学习效果减半
    let total = 0;
    for (const k of keys) {
      // 每科独立掷骰：运气 × 学科天赋 × 特质 × 压力倍率 × 时长倍率
      const luck = LUCK.min + rng() * (LUCK.max - LUCK.min);
      const before = st.mastery[k];
      // 收益递减：熟练度越高，本次增幅越小
      const dim = Math.max(DIMINISHING.floor, 1 - before / DIMINISHING.cap);
      const delta =
        action.gain * STUDY_SCALE * timeMult * mult * mods.gain * st.aptitude[k] * luck * dim * sickMult;
      st.mastery[k] = clamp(before + delta, 0, 100);
      total += st.mastery[k] - before;
    }
    gains[st.id] = total;
    // 压力增幅：基础值 × 特质倍率 × 随机 0.8~1.2
    st.pressure += action.pressure * mods.pressure * (0.8 + rng() * 0.4);
  }

  const week = state.absWeek + 1;
  const logs = [];
  const subjNames = keys.map((k) => SUBJECT_BY_KEY[k].name).join('、');
  logs.push({
    w: week,
    type: 'action',
    text: `${action.icon} ${action.name}：${ids.length} 名学生 × ${keys.length} 科（${subjNames}），花费 ${cost}`,
  });
  const ranked = Object.entries(gains).sort((a, b) => b[1] - a[1]);
  if (ranked.length >= 2) {
    const best = students[ranked[0][0]];
    const worst = students[ranked[ranked.length - 1][0]];
    logs.push({
      w: week,
      type: 'info',
      text: `🌟 进步最快：${best.name}（+${ranked[0][1].toFixed(1)}）｜😵 进步最慢：${worst.name}（+${ranked[ranked.length - 1][1].toFixed(1)}）`,
    });
  }
  const collapsed = applyCollapse(students, logs, week);
  let morale = state.morale + collapsed * MORALE.collapse;
  const semester = { ...state.semester, collapses: state.semester.collapses + collapsed };

  let exams = state.exams;
  if (action.exam) {
    const exam = makeExam(students, state.x, `${action.name}（${subjNames}）`, keys, seed, week);
    exams = [...exams, exam].slice(-30);
    logs.push({ w: week, type: 'exam', text: `📊 ${exam.title} 已完成`, exam });
    morale += examMoraleDelta(exam.mean);
    semester.bestExamRate = Math.max(semester.bestExamRate, exam.mean);
  }

  return {
    ...state,
    students,
    exams,
    semester,
    morale: clampMorale(morale),
    budget: state.budget - cost,
    actionsLeft: state.actionsLeft - slots,
    log: [...state.log, ...logs].slice(-200),
  };
}

/** 看病：选中的病号 ¥SICK.cost/人，病程缩短为 SICK.treatWeeks 周 */
function doTreat(state, { students: ids }) {
  const sick = state.students.filter((s) => ids.includes(s.id) && s.sickWeeks > 0);
  if (!sick.length || state.actionsLeft < 1) return state;
  const cost = SICK.cost * sick.length;
  if (cost > state.budget) {
    return pushLog(state, `班费不足：看病需要 ${cost}，余额 ${state.budget}`, 'warn');
  }
  const set = new Set(sick.map((s) => s.id));
  const students = cloneStudents(state.students).map((st) =>
    set.has(st.id) ? { ...st, sickWeeks: Math.min(st.sickWeeks, SICK.treatWeeks) } : st,
  );
  return {
    ...state,
    students,
    budget: state.budget - cost,
    actionsLeft: state.actionsLeft - 1,
    log: [
      ...state.log,
      { w: state.absWeek + 1, type: 'relief', text: `🏥 看病治疗：${sick.map((s) => s.name).join('、')}，花费 ${cost}，病程缩短至 ${SICK.treatWeeks} 周` },
    ].slice(-200),
  };
}

function doRelief(state, { actionId, students: ids }) {
  const action = RELIEF_ACTIONS.find((a) => a.id === actionId);
  const slots = action?.slots || 1;
  if (!action || state.actionsLeft < slots || !ids.length) return state;
  const cost = reliefCost(action, ids.length);
  if (cost > state.budget) {
    return pushLog(state, `班费不足：「${action.name}」需要 ${cost}，余额 ${state.budget}`, 'warn');
  }
  const picked = new Set(ids);
  const students = cloneStudents(state.students).map((st) =>
    picked.has(st.id) ? { ...st, pressure: Math.max(0, st.pressure - action.delta) } : st,
  );
  return {
    ...state,
    students,
    morale: clampMorale(state.morale + MORALE.relief),
    budget: state.budget - cost,
    actionsLeft: state.actionsLeft - slots,
    log: [
      ...state.log,
      { w: state.absWeek + 1, type: 'relief', text: `${action.icon} ${action.name}：${ids.length} 名学生压力 -${action.delta}%，花费 ${cost}` },
    ].slice(-200),
  };
}

/* ---------------- 随机事件（至少 8 种） ---------------- */
const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const bumpMastery = (st, rng, delta) => {
  const k = pickOne(ALL_KEYS, rng);
  st.mastery[k] = clamp(st.mastery[k] + delta, 0, 100);
  return SUBJECT_BY_KEY[k].name;
};

export const EVENTS = [
  {
    id: 'sick', icon: '🤒', title: '同学生病请假',
    run(students, rng) {
      const healthy = students.filter((s) => s.sickWeeks === 0);
      if (!healthy.length) return { text: '没有新的学生生病', budgetDelta: 0 };
      const st = pickOne(healthy, rng);
      st.sickWeeks = SICK.defaultWeeks;
      st.pressure += 20;
      return { text: `${st.name} 生病了，病程 ${SICK.defaultWeeks} 周，每周能力下降，学习效果减半（可花 ¥${SICK.cost} 看病）`, budgetDelta: 0, sick: 1 };
    },
  },
  {
    id: 'donation', icon: '💰', title: '家长捐款',
    run(students, rng) {
      const amt = Math.round((500 + rng() * 1500) / 10) * 10;
      return { text: `热心家长捐款 ${amt} 元，班费增加！`, budgetDelta: amt };
    },
  },
  {
    id: 'conflict', icon: '⚡', title: '学生冲突',
    run(students, rng) {
      const pool = [...students];
      const a = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const b = pool.length ? pickOne(pool, rng) : null;
      a.pressure += 15;
      if (b) b.pressure += 15;
      return {
        text: b ? `${a.name} 与 ${b.name} 发生争执，双方压力 +15%` : `${a.name} 与他人起了冲突，压力 +15%`,
        budgetDelta: 0,
      };
    },
  },
  {
    id: 'award', icon: '🏆', title: '意外获奖',
    run(students, rng) {
      const st = pickOne(students, rng);
      const subj = bumpMastery(st, rng, 25);
      return { text: `${st.name} 在竞赛中意外获奖！${subj} 熟练度大幅提升 +25`, budgetDelta: 0 };
    },
  },
  {
    id: 'flu', icon: '🤧', title: '流感爆发',
    run(students) {
      students.forEach((st) => (st.pressure += 10));
      return { text: '班里爆发流感，全班压力 +10%', budgetDelta: 0 };
    },
  },
  {
    id: 'sharing', icon: '📚', title: '学霸分享会',
    run(students, rng) {
      const k = pickOne(ALL_KEYS, rng);
      students.forEach((st) => (st.mastery[k] = clamp(st.mastery[k] + 5, 0, 100)));
      return { text: `学霸分享会！全班 ${SUBJECT_BY_KEY[k].name} 熟练度 +5`, budgetDelta: 0 };
    },
  },
  {
    id: 'broken', icon: '🔧', title: '设备损坏',
    run() {
      return { text: '投影仪坏了，维修花费 300 元', budgetDelta: -300 };
    },
  },
  {
    id: 'letter', icon: '💌', title: '匿名鼓励信',
    run(students, rng) {
      const st = pickOne(students, rng);
      st.pressure = Math.max(0, st.pressure - 20);
      return { text: `${st.name} 收到一封匿名鼓励信，压力 -20%`, budgetDelta: 0 };
    },
  },
  // ---- 惊喜与惊吓（概率与强度都更大） ----
  {
    id: 'grant', icon: '🏛️', title: '教育拨款',
    run(students, rng) {
      const amt = 800 + Math.round((rng() * 1200) / 100) * 100;
      return { text: `教育局下发专项拨款 ${amt} 元，班费增加！`, budgetDelta: amt };
    },
  },
  {
    id: 'lottery', icon: '🎰', title: '班费意外中奖',
    run(students, rng) {
      const amt = 1500 + Math.round((rng() * 3500) / 100) * 100;
      return { text: `班级团体彩票中了 ${amt} 元！`, budgetDelta: amt };
    },
  },
  {
    id: 'mentor', icon: '🌟', title: '神秘导师',
    run(students, rng) {
      const st = pickOne(students, rng);
      const k = pickOne(ALL_KEYS, rng);
      st.mastery[k] = clamp(st.mastery[k] + 30, 0, 100);
      return { text: `一位神秘导师指点了 ${st.name}，${SUBJECT_BY_KEY[k].name} 大幅进步 +30`, budgetDelta: 0 };
    },
  },
  {
    id: 'prodigy', icon: '⚡', title: '神童爆发',
    run(students, rng) {
      const st = pickOne(students, rng);
      ALL_KEYS.forEach((k) => (st.mastery[k] = clamp(st.mastery[k] + 8, 0, 100)));
      return { text: `${st.name} 突然开窍，全科熟练度 +8`, budgetDelta: 0 };
    },
  },
  {
    id: 'breakdown', icon: '😭', title: '学生情绪崩溃',
    run(students, rng) {
      const st = pickOne(students, rng);
      st.pressure += 60;
      return { text: `${st.name} 在考后情绪崩溃，压力 +60%`, budgetDelta: 0 };
    },
  },
  {
    id: 'rumor', icon: '🗣️', title: '校园流言',
    run(students, rng) {
      const pool = [...students];
      const a = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      a.pressure += 35;
      const b = pool.length ? pickOne(pool, rng) : null;
      if (b) b.pressure += 20;
      return { text: b ? `关于 ${a.name} 和 ${b.name} 的流言传开，压力分别 +35% / +20%` : `关于 ${a.name} 的流言传开，压力 +35%`, budgetDelta: 0 };
    },
  },
  {
    id: 'poison', icon: '🤢', title: '食堂食物中毒',
    run(students, rng) {
      const picked = [...students].sort(() => rng() - 0.5).slice(0, 3);
      picked.forEach((st) => (st.pressure += 25));
      return { text: `${picked.map((s) => s.name).join('、')} 食物中毒住院，压力 +25%，班费支付医药费 -600`, budgetDelta: -600 };
    },
  },
  {
    id: 'complaint', icon: '📣', title: '家长投诉',
    run(students, rng) {
      const st = pickOne(students, rng);
      st.pressure += 20;
      return { text: `${st.name} 家长投诉班主任，压力 +20%，处理费用 -400`, budgetDelta: -400 };
    },
  },
  {
    id: 'leak', icon: '💧', title: '教室漏水',
    run() {
      return { text: '教室天花板漏水，紧急维修花费 -1000', budgetDelta: -1000 };
    },
  },
  {
    id: 'runaway', icon: '🚪', title: '离家出走',
    run(students, rng) {
      const st = pickOne(students, rng);
      st.pressure += 80;
      ALL_KEYS.forEach((k) => (st.mastery[k] = Math.max(0, st.mastery[k] - 5)));
      return { text: `${st.name} 离家出走一天，压力 +80%，全科熟练度 -5`, budgetDelta: 0 };
    },
  },
];

/** 偏正面的事件（用于界面配色与士气） */
const GOOD_EVENT_IDS = ['donation', 'award', 'sharing', 'letter', 'grant', 'lottery', 'mentor', 'prodigy'];

/**
 * 周结算：考试 → 压力衰减/退步 → 士气（压力/事件）→ 班费收入 → 随机事件 → 崩溃检查
 *        → 便签 → 学期末小目标结算 → 进入下周
 */
function doEndWeek(state, seed) {
  if (state.finished) return state;
  const rng = mulberry32(seed);
  const subSeed = () => Math.floor(rng() * 4294967296);
  const students = cloneStudents(state.students);
  const week = state.absWeek + 1;
  const wt = (state.absWeek % CALENDAR.weeksPerSemester) + 1; // 学期内第几周
  const logs = [];
  let exams = state.exams;
  let morale = state.morale;
  const semester = { ...state.semester };

  // 1. 定期考试（自动触发，不花费班费）
  let spec = null;
  if (wt === CALENDAR.finalWeek) spec = { title: '期末考试', keys: ALL_KEYS };
  else if (wt === CALENDAR.midtermWeek) spec = { title: '期中考试', keys: ALL_KEYS };
  else if (CALENDAR.monthlyWeeks.includes(wt)) spec = { title: '月考（语数英）', keys: CORE_KEYS };
  if (spec) {
    const exam = makeExam(students, state.x, spec.title, spec.keys, subSeed(), week);
    exams = [...exams, exam].slice(-30);
    logs.push({ w: week, type: 'exam', text: `📊 ${spec.title} 已自动举行`, exam });
    morale += examMoraleDelta(exam.mean);
    semester.bestExamRate = Math.max(semester.bestExamRate, exam.mean);
  }

  // 2. 压力自然衰减 + 高压退步 + 生病持续与能力下降
  for (const st of students) {
    st.pressure = Math.max(0, st.pressure - PRESSURE.decayPerWeek);
    if (st.pressure > PRESSURE.stallThreshold) {
      ALL_KEYS.forEach((k) => (st.mastery[k] = Math.max(0, st.mastery[k] - PRESSURE.regressPerWeek)));
    }
    if (st.sickWeeks > 0) {
      ALL_KEYS.forEach((k) => (st.mastery[k] = Math.max(0, st.mastery[k] - SICK.weeklyDecline)));
      st.sickWeeks -= 1;
      if (st.sickWeeks === 0) logs.push({ w: week, type: 'info', text: `💊 ${st.name} 病愈回到班级` });
    }
  }

  // 2b. 全班平均压力影响士气
  const avgP = students.reduce((a, s) => a + s.pressure, 0) / (students.length || 1);
  if (avgP > MORALE.pressureHigh) morale += MORALE.weeklyDrop;
  else if (avgP < MORALE.pressureLow) morale += MORALE.weeklyGain;

  // 3. 班费收入
  let budget = state.budget + state.income;

  // 4. 随机事件（概率触发）
  // 可连环发生：第一件概率 eventChance，之后每件以 extraEventChance 追加，最多 maxEventsPerWeek 件
  const events = [];
  if (rng() < CALENDAR.eventChance) {
    while (events.length < CALENDAR.maxEventsPerWeek) {
      const ev = pickOne(EVENTS, rng);
      const res = ev.run(students, rng);
      budget = Math.max(0, budget + res.budgetDelta);
      const good = GOOD_EVENT_IDS.includes(ev.id);
      semester.sick += res.sick || 0;
      morale += good ? MORALE.goodEvent : MORALE.badEvent;
      events.push({ icon: ev.icon, title: ev.title, text: res.text, good, week });
      logs.push({ w: week, type: 'event', text: `${ev.icon} ${ev.title}：${res.text}` });
      if (rng() >= CALENDAR.extraEventChance) break;
    }
  }
  const event = events.length ? events : null;

  // 5. 崩溃检查（事件/退步之后统一检查）
  const collapsed = applyCollapse(students, logs, week);
  semester.collapses += collapsed;
  morale += collapsed * MORALE.collapse;

  // 6. 班主任便签：按当前士气选语气，随机抽一条
  morale = clampMorale(morale);
  const tone = morale >= 70 ? 'high' : morale < 40 ? 'low' : 'mid';
  const note = pickOne(TEACHER_NOTES[tone], rng);

  // 7. 学期末：小目标结算（学期最后一周）
  const nextAbs = state.absWeek + 1;
  const finished = nextAbs >= state.totalWeeks;
  // 全部学年结束时，执行一次高考
  const gaokao = finished && !state.gaokao ? runGaokao(students, seed ^ 0x9e3779b9) : state.gaokao;
  let goals = state.goals;
  let goalResults = state.goalResults;
  let lastSemesterClean = state.lastSemesterClean;
  if (wt === CALENDAR.weeksPerSemester) {
    const ctx = { students, budget, semester };
    const results = (state.goals || [])
      .map((id) => GOAL_BY_ID[id])
      .filter(Boolean)
      .map((g) => ({ id: g.id, name: g.name, done: !!g.check(ctx), reward: g.reward }));
    for (const r of results) {
      if (r.done) {
        budget += r.reward.budget || 0;
        morale += r.reward.morale || 0;
        logs.push({
          w: week, type: 'goal',
          text: `🎯 小目标达成「${r.name}」${r.reward.budget ? `，班费 +${r.reward.budget}` : ''}${r.reward.morale ? `，士气 +${r.reward.morale}` : ''}`,
        });
      } else {
        morale += MORALE.goalFail;
        logs.push({ w: week, type: 'warn', text: `🎯 小目标未达成「${r.name}」，士气 ${MORALE.goalFail}` });
      }
    }
    if (results.length) {
      const doneCount = results.filter((r) => r.done).length;
      logs.push({ w: week, type: 'goal', text: `🎯 本学期小目标：达成 ${doneCount}/${results.length}` });
    }
    goalResults = results.map(({ id, name, done }) => ({ id, name, done }));
    lastSemesterClean = semester.sick === 0;
    Object.assign(semester, freshSemester());
    goals = finished ? goals : drawGoals(rng);
  }

  logs.unshift({ w: week, type: 'week', text: `—— 第 ${week} 周结束，班费 +${state.income} ——` });
  if (finished) logs.push({ w: week, type: 'info', text: '🎓 全部学年已结束，毕业啦！' });

  return {
    ...state,
    students,
    exams,
    budget,
    absWeek: nextAbs,
    actionsLeft: CALENDAR.actionsPerWeek,
    event,
    finished,
    gaokao,
    morale: clampMorale(morale),
    note,
    goals,
    goalResults,
    semester,
    lastSemesterClean,
    log: [...state.log, ...logs].slice(-200),
  };
}

/** 成就判定：每次状态变化后检查，已解锁的不重复解锁；解锁即加士气 */
export function unlockAchievements(state) {
  const have = new Set(state.achievements || []);
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(state));
  if (!fresh.length) return state;
  return {
    ...state,
    achievements: [...have, ...fresh.map((a) => a.id)],
    morale: clampMorale(state.morale + fresh.length * MORALE.achievement),
    log: [
      ...state.log,
      ...fresh.map((a) => ({ w: Math.max(1, state.absWeek), type: 'achv', text: `🏅 解锁成就「${a.name}」：${a.desc}` })),
    ].slice(-200),
  };
}

/** 统一 reducer：所有随机种子由调用方（前端或服务端）通过 action.seed / payload.seed 提供 */
export function gameReducer(state, action) {
  if (action.type === 'START') return createGame(action.payload);
  if (action.type === 'RESET') return null;
  if (action.type === 'DISMISS_EXAM') return state; // 考试弹窗是纯界面状态
  if (action.type === 'DISMISS_GAOKAO') return state ? { ...state, gaokaoDismissed: true } : state;
  // 读取存档：直接用存档里的状态替换当前状态
  if (action.type === 'LOAD_SAVE') return action.payload ? { ...action.payload } : state;
  const cur = state && state.mode === undefined ? migrateState(state) : state;
  if (!cur) return cur;
  switch (action.type) {
    case 'STUDY':
      return unlockAchievements(doStudy(cur, action));
    case 'RELIEF':
      return unlockAchievements(doRelief(cur, action));
    case 'TREAT':
      return unlockAchievements(doTreat(cur, action));
    case 'END_WEEK':
      return unlockAchievements(doEndWeek(cur, action.seed));
    case 'DISMISS_EVENT':
      return { ...cur, event: null };
    default:
      return cur;
  }
}

const INTENT_TYPES = ['START', 'STUDY', 'RELIEF', 'TREAT', 'END_WEEK', 'DISMISS_EVENT', 'RESET'];

/**
 * 校验客户端意图（联机服务端使用）。返回 null 表示合法，否则返回中文错误原因。
 * 只检查参数是否合法、资源是否足够；真正的结算仍由 gameReducer 完成。
 */
export function validateIntent(state, intent) {
  if (!intent || typeof intent !== 'object') return '无效的操作';
  const { type } = intent;
  if (!INTENT_TYPES.includes(type)) return `未知操作：${type}`;
  if (type === 'START') {
    if (state) return '游戏已经开始，请先重开';
    if (!SYSTEMS[intent.system]) return '学制无效';
    if (!DIFFICULTY[intent.difficulty]) return '难度无效';
    if (!MODES[intent.mode]) return '时长模式无效';
    if (!Number.isInteger(intent.x) || intent.x < 1 || intent.x > 200) return '学生人数须为 1~200 的整数';
    if (
      !Array.isArray(intent.names) ||
      intent.names.length !== intent.x ||
      intent.names.some((n) => typeof n !== 'string' || !n.trim() || n.length > 20)
    ) return '学生姓名无效';
    return null;
  }
  if (type === 'RESET') return null;
  if (!state) return '还没有开始游戏';
  if (type === 'DISMISS_EVENT') return null;
  if (state.finished) return '已经毕业，无法继续操作';
  if (type === 'END_WEEK') return null;

  const ids = new Set(state.students.map((s) => s.id));
  const validIds = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((id) => ids.has(id));

  if (type === 'STUDY') {
    const action = STUDY_ACTIONS.find((a) => a.id === intent.actionId);
    if (!action) return '学习行动无效';
    if (!validIds(intent.students)) return '请选择有效的学生';
    if (!Array.isArray(intent.subjects) || !intent.subjects.length || intent.subjects.some((k) => !ALL_KEYS.includes(k))) {
      return '请选择有效的科目';
    }
    if (state.actionsLeft < (action.slots || 1)) return '本周行动次数不足';
    const cost = studyCost(action, intent.students.length, intent.subjects.length);
    if (cost > state.budget) return `班费不足：需要 ${cost}，余额 ${state.budget}`;
    return null;
  }
  if (type === 'RELIEF') {
    const action = RELIEF_ACTIONS.find((a) => a.id === intent.actionId);
    if (!action) return '减压行动无效';
    if (!validIds(intent.students)) return '请选择有效的学生';
    if (state.actionsLeft < (action.slots || 1)) return '本周行动次数不足';
    const cost = reliefCost(action, intent.students.length);
    if (cost > state.budget) return `班费不足：需要 ${cost}，余额 ${state.budget}`;
    return null;
  }
  if (type === 'TREAT') {
    if (!validIds(intent.students)) return '请选择有效的学生';
    const sickSelected = state.students.some((s) => intent.students.includes(s.id) && s.sickWeeks > 0);
    if (!sickSelected) return '选中的学生中没有病号';
    if (state.actionsLeft < 1) return '本周行动次数不足';
    const cost = SICK.cost * state.students.filter((s) => intent.students.includes(s.id) && s.sickWeeks > 0).length;
    if (cost > state.budget) return `班费不足：看病需要 ${cost}，余额 ${state.budget}`;
    return null;
  }
  return '无法处理的操作';
}

/* 统计工具 */
export function classStats(state) {
  const n = state.students.length || 1;
  const avgPressure = state.students.reduce((a, s) => a + s.pressure, 0) / n;
  const allMastery = state.students.flatMap((s) => ALL_KEYS.map((k) => s.mastery[k]));
  const avgMastery = allMastery.reduce((a, b) => a + b, 0) / (allMastery.length || 1);
  return { avgPressure, avgGrade: gradeOf(avgMastery), avgMastery };
}
