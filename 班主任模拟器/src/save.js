// 存档：使用 localStorage，每个存档槽位单独保存。
// 只保存可序列化的游戏状态（学生、班费、日志、考试记录、成就、高考结果等）。
import { termLabel, gradeOf } from './engine.js';
import { SUBJECTS } from './constants.js';

const PREFIX = 'dsh-save:';
const SLOTS = ['auto', '1', '2', '3'];
export const SLOT_LABELS = { auto: '自动存档', 1: '存档 1', 2: '存档 2', 3: '存档 3' };
const VERSION = 1;

const keyOf = (slot) => `${PREFIX}${slot}`;

/** 把游戏状态整理成存档对象 */
export function buildSave(state) {
  return {
    version: VERSION,
    savedAt: Date.now(),
    meta: describe(state),
    state,
  };
}

/** 存档摘要：给存档列表显示用 */
export function describe(state) {
  const n = state.students?.length || 0;
  const allMastery = (state.students || []).flatMap((s) => SUBJECTS.map((sub) => s.mastery[sub.key]));
  const avg = allMastery.length ? allMastery.reduce((a, b) => a + b, 0) / allMastery.length : 0;
  return {
    title: `${state.term || termLabel(state)}`,
    week: state.absWeek + 1,
    totalWeeks: state.totalWeeks,
    students: n,
    budget: state.budget,
    avgGrade: gradeOf(avg),
    mode: state.mode,
    system: state.system,
    difficulty: state.difficulty,
    finished: !!state.finished,
  };
}

/** 保存到指定槽位 */
export function saveTo(slot, state) {
  try {
    localStorage.setItem(keyOf(slot), JSON.stringify(buildSave(state)));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/** 读取指定槽位；不存在或损坏返回 null */
export function loadFrom(slot) {
  try {
    const raw = localStorage.getItem(keyOf(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== VERSION || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  localStorage.removeItem(keyOf(slot));
}

/** 列出所有槽位的摘要（没有存档的为 null） */
export function listSaves() {
  return SLOTS.map((slot) => {
    const s = loadFrom(slot);
    return s ? { slot, label: SLOT_LABELS[slot], savedAt: s.savedAt, meta: s.meta } : { slot, label: SLOT_LABELS[slot], savedAt: null, meta: null };
  });
}

/** 让用户下载存档文件（JSON） */
export function exportSave(state) {
  const data = JSON.stringify(buildSave(state), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `班主任模拟器-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 从文件导入存档，返回 { ok, save } 或 { ok:false, message } */
export function importSaveFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || parsed.version !== VERSION || !parsed.state) {
          resolve({ ok: false, message: '不是有效的存档文件（版本不匹配或缺少数据）' });
          return;
        }
        resolve({ ok: true, save: parsed });
      } catch (e) {
        resolve({ ok: false, message: '文件解析失败：' + e.message });
      }
    };
    reader.onerror = () => resolve({ ok: false, message: '读取文件失败' });
    reader.readAsText(file);
  });
}

/** 相对时间描述 */
export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
