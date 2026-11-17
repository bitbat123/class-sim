// ============ 班级小目标 & 成就定义（纯数据 + 纯判定函数，无副作用） ============
import { MASTERY_PER_GRADE, SUBJECTS } from './constants.js';

const ALL_KEYS = SUBJECTS.map((s) => s.key);
const CORE_KEYS = ['chinese', 'math', 'english'];
const PASS_MASTERY = 2 * MASTERY_PER_GRADE; // D 及以上视为及格（index 2）
const A_MASTERY = 5 * MASTERY_PER_GRADE;    // A 及以上（index 5）

const avgPressure = (students) =>
  students.reduce((a, s) => a + s.pressure, 0) / (students.length || 1);

/**
 * 学期小目标：每学期开始时从池中随机抽 2 个（由 reducer 的 seed 决定）。
 * check(ctx) 在学期结束时调用，ctx = { students, budget, semester }。
 * reward：达成后的额外奖励（budget 班费 / morale 士气）。
 */
export const GOAL_POOL = [
  {
    id: 'sickFree', name: '本学期零病假',
    reward: { morale: 8 },
    check: (c) => c.semester.sick === 0,
  },
  {
    id: 'noCollapse', name: '本学期无人崩溃',
    reward: { morale: 6 },
    check: (c) => c.semester.collapses === 0,
  },
  {
    id: 'passCore', name: '期末语数英全班及格（≥ D）',
    reward: { budget: 800 },
    check: (c) => c.students.every((s) => CORE_KEYS.every((k) => s.mastery[k] >= PASS_MASTERY)),
  },
  {
    id: 'calm', name: '期末全班平均压力 ≤ 30%',
    reward: { morale: 6 },
    check: (c) => avgPressure(c.students) <= 30,
  },
  {
    id: 'examHigh', name: '本学期某次考试班级均分率 ≥ 70%',
    reward: { budget: 600, morale: 4 },
    check: (c) => c.semester.bestExamRate >= 0.7,
  },
  {
    id: 'rich', name: '期末班费 ≥ ¥8000',
    reward: { budget: 500 },
    check: (c) => c.budget >= 8000,
  },
];

/** 永久成就：每个只解锁一次。check(state) 在每次状态变化后判定。 */
export const ACHIEVEMENTS = [
  {
    id: 'allPass', icon: '📗', name: '全班及格', desc: '全班语数英均达到 D 及以上',
    check: (s) => s.students.every((st) => CORE_KEYS.every((k) => st.mastery[k] >= PASS_MASTERY)),
  },
  {
    id: 'allA', icon: '🌈', name: '全科A', desc: '有学生 9 科均达到 A 及以上',
    check: (s) => s.students.some((st) => ALL_KEYS.every((k) => st.mastery[k] >= A_MASTERY)),
  },
  {
    id: 'noSickSem', icon: '💪', name: '零病假一学期', desc: '完成一个学期且无人生病',
    check: (s) => s.lastSemesterClean === true,
  },
  {
    id: 'fund', icon: '💰', name: '班费破万', desc: '开学之后，班费余额达到 ¥10000',
    check: (s) => s.absWeek > 0 && s.budget >= 10000,
  },
  {
    id: 'morale', icon: '🔥', name: '士气爆表', desc: '班级士气达到 90',
    check: (s) => s.morale >= 90,
  },
];

export const GOAL_BY_ID = Object.fromEntries(GOAL_POOL.map((g) => [g.id, g]));
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
