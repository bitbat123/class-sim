import React from 'react';
import { GOAL_BY_ID, ACHIEVEMENTS } from '../goals.js';

const moraleColor = (m) => (m >= 70 ? '#22c55e' : m >= 40 ? '#f59e0b' : '#ef4444');
const moraleLabel = (m) => (m >= 85 ? '斗志昂扬' : m >= 70 ? '士气高涨' : m >= 40 ? '平稳' : m >= 20 ? '有些低落' : '低气压');

/**
 * 班级士气 + 本学期小目标 + 成就墙 + 班主任便签
 * 纯展示组件，所有数据来自 state（单机为本地 reducer，联机为服务端广播）。
 */
export default function MoralePanel({ state }) {
  const morale = Math.round(state.morale ?? 60);
  const unlocked = new Set(state.achievements || []);
  const goals = (state.goals || []).map((id) => GOAL_BY_ID[id]).filter(Boolean);
  const prev = state.goalResults || [];

  return (
    <div className="card morale-panel">
      <div className="ap-head">
        <h3>🔥 班级士气</h3>
        <b style={{ color: moraleColor(morale) }}>{morale} · {moraleLabel(morale)}</b>
      </div>
      <div className="morale-track">
        <div className="morale-fill" style={{ width: `${morale}%`, background: moraleColor(morale) }} />
      </div>

      <div className="note-box">
        <span className="note-tag">📝 班主任便签</span>
        <span>{state.note || '新学期开始，先认识一下每一位同学吧。'}</span>
      </div>

      <div className="ap-label">🎯 本学期小目标</div>
      {goals.length ? (
        <ul className="goal-list">
          {goals.map((g) => (
            <li key={g.id}>{g.name}<em className="muted"> · 奖励 {rewardText(g.reward)}</em></li>
          ))}
        </ul>
      ) : (
        <div className="muted small">（无）</div>
      )}
      {prev.length > 0 && (
        <div className="muted small">
          上学期结果：{prev.map((r) => `${r.done ? '✅' : '❌'}${r.name}`).join('　')}
        </div>
      )}

      <div className="ap-label">🏅 成就（{unlocked.size}/{ACHIEVEMENTS.length}）</div>
      <div className="achv-grid">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`achv ${unlocked.has(a.id) ? 'on' : ''}`} title={a.desc}>
            <span>{unlocked.has(a.id) ? a.icon : '🔒'}</span>
            <span>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function rewardText(r = {}) {
  const parts = [];
  if (r.budget) parts.push(`班费 +${r.budget}`);
  if (r.morale) parts.push(`士气 +${r.morale}`);
  return parts.join(' ');
}
