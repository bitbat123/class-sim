import React, { useMemo, useState } from 'react';
import { SUBJECTS, STUDY_ACTIONS, RELIEF_ACTIONS, MEDICAL_ACTIONS, SICK } from '../constants.js';
import { studyCost, reliefCost } from '../engine.js';

/** 行动卡片上的动态效果文字（随 x、y 实时变化） */
function effectText(mode, a, x, y) {
  if (mode === 'relief') return `压力 -${a.delta}%`;
  if (mode === 'medical') return `病程缩短至 ${SICK.treatWeeks} 周`;
  if (y === 0) return '请先勾选科目';
  const perSubject = a.gain;
  return `每科 +${perSubject} 熟练 × ${y}科 · 压力 +${a.pressure}%`;
}

/** 行动面板：选择学习/减压行动，勾选科目与学生，显示预计花费与效果 */
export default function ActionPanel({ state, onStudy, onRelief, onTreat }) {
  const [mode, setMode] = useState('study'); // study | relief | medical
  const [actionId, setActionId] = useState('homework');
  const [subjects, setSubjects] = useState(['chinese', 'math', 'english']);
  const [picked, setPicked] = useState(() => new Set());
  const [pressureFilter, setPressureFilter] = useState(0); // 只选压力 ≥ 该值的学生

  const actions = mode === 'study' ? STUDY_ACTIONS : mode === 'relief' ? RELIEF_ACTIONS : MEDICAL_ACTIONS;
  const action = actions.find((a) => a.id === actionId) || actions[0];
  const sickCount = state.students.filter((s) => s.sickWeeks > 0).length;

  const eligible = state.students.filter((s) => s.pressure >= pressureFilter);
  const selectedIds = [...picked].filter((id) => eligible.some((s) => s.id === id));
  const x = selectedIds.length;
  const y = subjects.length;

  // 动态结果：卡片上显示「当前选择下」的实际花费（x、y 随勾选实时变化）
  const costOf = (a) =>
    mode === 'study' ? studyCost(a, x, Math.max(y, 1)) : mode === 'relief' ? reliefCost(a, x) : SICK.cost * x;
  const cost = costOf(action);
  const slots = action.slots || 1;
  const noAction = state.actionsLeft < slots;
  const disabled = noAction || x === 0 || (mode === 'study' && y === 0) || cost > state.budget
    || (mode === 'medical' && sickCount === 0);

  const toggle = (set, v) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  };

  const toggleSubject = (k) =>
    setSubjects((arr) => (arr.includes(k) ? arr.filter((v) => v !== k) : [...arr, k]));

  const selectAll = () => setPicked(new Set(eligible.map((s) => s.id)));
  const invert = () => setPicked(new Set(state.students.map((s) => s.id).filter((id) => !picked.has(id))));
  const clear = () => setPicked(new Set());

  const submit = () => {
    if (mode === 'study') onStudy({ actionId, students: selectedIds, subjects });
    else if (mode === 'relief') onRelief({ actionId, students: selectedIds });
    else onTreat({ students: selectedIds });
    setPicked(new Set());
  };

  // 效果预览
  const preview = useMemo(() => {
    if (mode === 'relief') return `选中学生压力 -${action.delta}%`;
    if (mode === 'medical') return `病号病程缩短至 ${SICK.treatWeeks} 周，每人 ¥${SICK.cost}（仅对病号生效）`;
    return `每科熟练度基础 +${action.gain}（按压力倍率：≤50% ×1.0 / 50–100% ×0.7 / >100% 不进步）· 压力 +${action.pressure}%`;
  }, [mode, action]);

  return (
    <div className="card action-panel">
      <div className="ap-head">
        <h3>🎮 行动面板</h3>
        <span className="muted">本周剩余 {state.actionsLeft} 次</span>
      </div>

      <div className="seg wide">
        <button className={mode === 'study' ? 'on' : ''} onClick={() => { setMode('study'); setActionId(STUDY_ACTIONS[0].id); }}>📚 学习</button>
        <button className={mode === 'relief' ? 'on' : ''} onClick={() => { setMode('relief'); setActionId(RELIEF_ACTIONS[0].id); }}>🌤 放松</button>
        <button className={mode === 'medical' ? 'on' : ''} onClick={() => { setMode('medical'); setActionId(MEDICAL_ACTIONS[0].id); }}>🏥 医疗{sickCount > 0 ? ` (${sickCount})` : ''}</button>
      </div>

      <div className="action-list">
        {actions.map((a) => {
          const aCost = costOf(a);
          const canAfford = aCost <= state.budget && x > 0 && (mode === 'relief' || y > 0);
          return (
            <button
              key={a.id}
              className={`action-item ${actionId === a.id ? 'sel' : ''}`}
              onClick={() => setActionId(a.id)}
              title={a.desc}
            >
              <span className="ai-icon">{a.icon}</span>
              <span className="ai-name">{a.name}</span>
              <span className={`ai-cost ${canAfford ? '' : 'short'}`}>
                {x === 0 ? '请先选学生' : aCost === 0 ? '免费' : `¥${aCost.toLocaleString()}`}
              </span>
              <span className="ai-effect">
                {effectText(mode, a, x, y)}
                {a.slots > 1 && <em className="slot-tag"> · 耗 {a.slots} 次行动</em>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ap-desc">
        {action.desc}
        <div className="ap-live">
          {x > 0
            ? mode === 'study'
              ? `当前：${x} 人 × ${y} 科 → 花费 ${cost ? `¥${cost.toLocaleString()}` : '免费'}，消耗 ${slots} 次行动，预计每人每科约 +${action.gain}（受天赋/特质/压力影响）`
              : mode === 'relief'
                ? `当前：${x} 人 → 花费 ${cost ? `¥${cost.toLocaleString()}` : '免费'}，消耗 ${slots} 次行动，选中学生压力 -${action.delta}%`
                : sickCount === 0 ? '当前没有病号' : `当前选中 ${x} 人（病号将被治疗）→ 花费 ¥${cost.toLocaleString()}，消耗 1 次行动`
            : '请先勾选学生'}
        </div>
      </div>

      {mode === 'study' && (
        <>
          <div className="ap-label">选择科目（y = {y}）</div>
          <div className="chips">
            {SUBJECTS.map((s) => (
              <label key={s.key} className={`chip ${subjects.includes(s.key) ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={subjects.includes(s.key)}
                  onChange={() => toggleSubject(s.key)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </>
      )}

      <div className="ap-label">
        选择学生（x = {x}/{state.students.length}）
      </div>
      <div className="btn-row">
        <button className="btn-small" onClick={selectAll}>全选</button>
        <button className="btn-small" onClick={invert}>反选</button>
        <button className="btn-small" onClick={clear}>清空</button>
      </div>
      <div className="filter-row">
        <span>压力 ≥</span>
        <input
          type="range"
          min={0}
          max={250}
          step={10}
          value={pressureFilter}
          onChange={(e) => setPressureFilter(Number(e.target.value))}
        />
        <b>{pressureFilter}%</b>
        <button className="btn-small" onClick={() => setPicked(new Set(eligible.map((s) => s.id)))}>
          按筛选选中
        </button>
      </div>
      <div className="pick-list">
        {state.students.map((s) => (
          <label
            key={s.id}
            className={`pick ${picked.has(s.id) ? 'on' : ''} ${s.pressure < pressureFilter ? 'dim' : ''}`}
          >
            <input
              type="checkbox"
              checked={picked.has(s.id)}
              onChange={() => setPicked((p) => toggle(p, s.id))}
            />
            <span>{s.name}{s.sickWeeks > 0 && <em className="sick-tag"> 🤒{s.sickWeeks}周</em>}</span>
            <small style={{ color: s.pressure > 100 ? '#ef4444' : undefined }}>{s.pressure.toFixed(0)}%</small>
          </label>
        ))}
      </div>

      <div className="cost-box">
        <div>
          <span className="muted">预计花费：</span>
          <b className={cost > state.budget ? 'danger' : ''}>
            ¥{cost.toLocaleString()}
          </b>
          <span className="muted"> / 余额 ¥{state.budget.toLocaleString()}</span>
        </div>
        <div className="muted small">{preview}</div>
        {mode === 'study' && (
          <div className="muted small">
            ≥ 压力 100% 的学生本次不会进步（倍率 0）
          </div>
        )}
      </div>

      <button className="btn-primary big" disabled={disabled} onClick={submit}>
        {noAction ? '本周行动不足' : `执行「${action.name}」${slots > 1 ? `（耗 ${slots} 次）` : ''}`}
      </button>
    </div>
  );
}
