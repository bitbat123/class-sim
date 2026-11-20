import React, { useState } from 'react';
import { SUBJECTS } from '../constants.js';

const LEVEL_COLORS = { S: '#fbbf24', A: '#a855f7', B: '#3b82f6', C: '#22c55e', D: '#f59e0b', E: '#f97316', F: '#ef4444' };

/** 分数颜色（按得分率） */
function scoreColor(score, max) {
  const pct = (score / max) * 100;
  if (pct < 60) return '#ef4444';
  if (pct < 75) return '#f97316';
  if (pct < 85) return '#eab308';
  if (pct < 95) return '#22c55e';
  return '#8b5cf6';
}

/**
 * 高考成绩单：总分、各科分数、录取学校、班内排名。
 * mode='modal' 时以弹窗形式展示，mode='page' 时作为页面区块。
 */
export default function GaokaoResult({ gaokao, onRestart, inline = false, onClose }) {
  const [selected, setSelected] = useState(null);
  if (!gaokao) return null;

  const { rows, avg, best, schoolCount } = gaokao;
  const top = rows[0];
  const detail = selected ? rows.find((r) => r.id === selected) : null;

  const body = (
    <div className={inline ? 'gaokao-block' : 'gaokao-modal card'}>
      <header className="gaokao-head">
        <h2>🎓 高考成绩</h2>
        <p className="muted small">
          全班 {rows.length} 人 · 平均分 <b>{avg}</b> / {top ? top.max : 1050} · 最高分 <b>{best ? best.total : 0}</b>
          {best && <>（{best.name} · {best.school}）</>}
        </p>
      </header>

      {/* 录取分布 */}
      <div className="gaokao-schools">
        {Object.entries(schoolCount).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
          <span key={name} className="school-chip">{name} × {n}</span>
        ))}
      </div>

      <div className="gaokao-table-wrap">
        <table className="gaokao-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>姓名</th>
              <th>总分</th>
              <th>录取</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === selected ? 'sel' : ''}>
                <td><span className={`rank ${r.rank <= 3 ? 'top' : ''}`}>{r.rank}</span></td>
                <td className="name">{r.name}{r.sick && <span className="tag-sick">病</span>}</td>
                <td>
                  <span className="gaokao-score" style={{ color: scoreColor(r.total, r.max) }}>{r.total}</span>
                  <small className="muted"> / {r.max}</small>
                </td>
                <td>
                  <span className="school-tag" style={{ background: LEVEL_COLORS[r.level] || '#64748b' }}>
                    {r.school}
                  </span>
                </td>
                <td>
                  <button className="btn-small" onClick={() => setSelected(selected === r.id ? null : r.id)}>
                    {selected === r.id ? '收起' : '各科'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="gaokao-detail">
          <h3>{detail.name} 的各科成绩</h3>
          <div className="subject-grid">
            {SUBJECTS.map((s) => (
              <div key={s.key} className="subject-cell">
                <div className="subject-name">{s.name}</div>
                <div className="subject-score" style={{ color: scoreColor(detail.scores[s.key], s.max) }}>
                  {detail.scores[s.key]}
                </div>
                <div className="muted small">/ {s.max}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gaokao-foot">
        <span className="muted small">
          分数 = 9 科熟练度 × 科目满分 ± 随机波动；总分 1050（语数英各 150 + 其余 6 科各 100）
        </span>
        <div className="gaokao-actions">
          {onClose && <button className="btn-small" onClick={onClose}>关闭</button>}
          {onRestart && <button className="btn-primary" onClick={onRestart}>🔄 再来一届</button>}
        </div>
      </div>
    </div>
  );

  if (inline) return body;
  return <div className="modal-mask">{body}</div>;
}
