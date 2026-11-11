// ============ 游戏核心逻辑（纯函数，无 React 依赖） ============
import {
  GRADES, MASTERY_PER_GRADE, SUBJECTS, SYSTEMS, DIFFICULTY,
  STUDY_ACTIONS, RELIEF_ACTIONS, PRESSURE, CALENDAR,
  TRAITS, TRAIT_BY_ID, APTITUDE, LUCK, DIMINISHING, STUDY_SCALE, SICK,
} from './constants.js';

const SUBJECT_BY_KEY = Object.fromEntries(SUBJECTS.map((s) => [s.key, s]));
const ALL_KEYS = SUBJECTS.map((s) => s.key);
const CORE_KEYS = ['chinese', 'math', 'english'];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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

export function createGame({ system, difficulty, x, names, seed = 1 }) {
  const diff = DIFFICULTY[difficulty];
  const years = SYSTEMS[system].years;
  const rng = mulberry32(seed);
  return {
    system,
    difficulty,
    x,
    years,
    totalWeeks: years.length * 2 * CALENDAR.weeksPerSemester,
    absWeek: 0,
    budget: diff.start(x),
    income: diff.income(x),
    actionsLeft: CALENDAR.actionsPerWeek,
    students: names.map((name, id) => makeStudent(id, name, rng)),
    exams: [],
    log: [{ w: 0, type: 'info', text: '开学啦！班费已到账，祝你好运～' }],
    event: null,
    finished: false,
  };
}

function cloneStudents(students) {
  return students.map((s) => ({ ...s, mastery: { ...s.mastery } }));
}

/**
 * 生成一场考试。分数 = 熟练度比例 ± 8% 随机波动。
 * 排名：班内排名 + 全校排名（以班级成绩均值/标准差估计正态分布，全校人数 = x * 20）。
 */
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

/** 崩溃判定：压力 > 250 → 所有科目归 F，压力重置为 0 */
function applyCollapse(students, logs, week) {
  for (const st of students) {
    if (st.pressure > PRESSURE.collapseThreshold) {
      ALL_KEYS.forEach((k) => (st.mastery[k] = 0));
      st.pressure = 0;
      logs.push({
        w: week,
        type: 'danger',
        text: `💥 ${st.name} 压力爆表（>${PRESSURE.collapseThreshold}%）崩溃了！所有科目归 F，压力清零`,
      });
    }
  }
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
  const gains = {}; // 每人本次总增幅，用于播报「进步最快/最慢」
  for (const st of students) {
    if (!picked.has(st.id)) continue;
    const mult = pressureMultiplier(st.pressure); // 使用行动前的压力计算倍率
    const mods = traitMods(st.traits);
    const sickMult = st.sickWeeks > 0 ? SICK.gainMult : 1; // 生病时学习效果减半
    let total = 0;
    for (const k of keys) {
      // 每科独立掷骰：运气 × 学科天赋 × 特质 × 压力倍率
      const luck = LUCK.min + rng() * (LUCK.max - LUCK.min);
      const before = st.mastery[k];
      // 收益递减：熟练度越高，本次增幅越小
      const dim = Math.max(DIMINISHING.floor, 1 - before / DIMINISHING.cap);
      const delta = action.gain * STUDY_SCALE * mult * mods.gain * st.aptitude[k] * luck * dim * sickMult;
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
  applyCollapse(students, logs, week);

  let exams = state.exams;
  if (action.exam) {
    const exam = makeExam(students, state.x, `${action.name}（${subjNames}）`, keys, seed, week);
    exams = [...exams, exam].slice(-30);
    logs.push({ w: week, type: 'exam', text: `📊 ${exam.title} 已完成`, exam });
  }

  return {
    ...state,
    students,
    exams,
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
      return { text: `${st.name} 生病了，病程 ${SICK.defaultWeeks} 周，每周能力下降，学习效果减半（可花 ¥${SICK.cost} 看病）`, budgetDelta: 0 };
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
  // ---- 新增：惊喜与惊吓（概率与强度都更大） ----
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

/** 偏正面的事件（用于界面配色） */
const GOOD_EVENT_IDS = ['donation', 'award', 'sharing', 'letter', 'grant', 'lottery', 'mentor', 'prodigy'];

/** 周结算：考试 → 压力衰减/退步 → 崩溃检查 → 班费收入 → 随机事件 → 进入下周 */
function doEndWeek(state, seed) {
  if (state.finished) return state;
  const rng = mulberry32(seed);
  const subSeed = () => Math.floor(rng() * 4294967296);
  const students = cloneStudents(state.students);
  const week = state.absWeek + 1;
  const wt = (state.absWeek % CALENDAR.weeksPerSemester) + 1; // 学期内第几周
  const logs = [];
  let exams = state.exams;

  // 1. 定期考试（自动触发，不花费班费）
  let spec = null;
  if (wt === CALENDAR.finalWeek) spec = { title: '期末考试', keys: ALL_KEYS };
  else if (wt === CALENDAR.midtermWeek) spec = { title: '期中考试', keys: ALL_KEYS };
  else if (CALENDAR.monthlyWeeks.includes(wt)) spec = { title: '月考（语数英）', keys: CORE_KEYS };
  if (spec) {
    const exam = makeExam(students, state.x, spec.title, spec.keys, subSeed(), week);
    exams = [...exams, exam].slice(-30);
    logs.push({ w: week, type: 'exam', text: `📊 ${spec.title} 已自动举行`, exam });
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
      events.push({ icon: ev.icon, title: ev.title, text: res.text, good: GOOD_EVENT_IDS.includes(ev.id), week });
      logs.push({ w: week, type: 'event', text: `${ev.icon} ${ev.title}：${res.text}` });
      if (rng() >= CALENDAR.extraEventChance) break;
    }
  }
  const event = events.length ? events : null;

  // 5. 崩溃检查（事件/退步之后统一检查）
  applyCollapse(students, logs, week);

  logs.unshift({ w: week, type: 'week', text: `—— 第 ${week} 周结束，班费 +${state.income} ——` });

  const nextAbs = state.absWeek + 1;
  const finished = nextAbs >= state.totalWeeks;
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
    log: [...state.log, ...logs].slice(-200),
  };
}

/** 统一 reducer：action 中的 seed 由调用方提供，保证 reducer 纯净 */
export function gameReducer(state, action) {
  switch (action.type) {
    case 'START':
      return createGame(action.payload);
    case 'STUDY':
      return state ? doStudy(state, action) : state;
    case 'RELIEF':
      return state ? doRelief(state, action) : state;
    case 'TREAT':
      return state ? doTreat(state, action) : state;
    case 'END_WEEK':
      return state ? doEndWeek(state, action.seed) : state;
    case 'DISMISS_EVENT':
      return state ? { ...state, event: null } : state;
    case 'DISMISS_EXAM':
      // 考试弹窗是纯界面状态，由 App 管理，这里不改动游戏状态
      return state;
    case 'RESET':
      return null;
    default:
      return state;
  }
}

/* 统计工具 */
export function classStats(state) {
  const n = state.students.length || 1;
  const avgPressure = state.students.reduce((a, s) => a + s.pressure, 0) / n;
  const allMastery = state.students.flatMap((s) => ALL_KEYS.map((k) => s.mastery[k]));
  const avgMastery = allMastery.reduce((a, b) => a + b, 0) / (allMastery.length || 1);
  return { avgPressure, avgGrade: gradeOf(avgMastery), avgMastery };
}
