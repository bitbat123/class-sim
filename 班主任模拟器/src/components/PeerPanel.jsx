import React from 'react';
import { classStats, termLabel } from '../engine.js';
import { GRADE_COLORS } from '../constants.js';

/**
 * 联机对比面板：两名玩家的班级统计并排显示。
 * players：useRoom().players；you：本人槽位。数据全部来自服务端广播的状态。
 */
export default function PeerPanel({ players, you }) {
  return (
    <div className="card peer-panel">
      <div className="ap-head">
        <h3>🌐 联机对比</h3>
        <span className="muted small">两班各自独立结算，由服务端统一判定</span>
      </div>
      <div className="peer-grid">
        {players.map((p) => (
          <PeerCard key={p.slot} player={p} isMe={p.slot === you} />
        ))}
      </div>
    </div>
  );
}

function PeerCard({ player, isMe }) {
  const st = player.state;
  const head = (
    <div className="peer-head">
      <b>{player.name || `玩家${player.slot + 1}`}</b>
      {isMe && <span className="peer-me">我</span>}
      {!player.connected && <span className="muted small">（离线）</span>}
    </div>
  );
  if (!st) {
    return (
      <div className="peer-card">
        {head}
        <div className="muted small">尚未开局</div>
      </div>
    );
  }
  const stats = classStats(st);
  const achv = (st.achievements || []).length;
  const pColor = stats.avgPressure > 100 ? '#ef4444' : stats.avgPressure > 50 ? '#f59e0b' : '#22c55e';
  return (
    <div className="peer-card">
      {head}
      <div className="peer-line muted small">{termLabel(st).split(' ')[0]} · 第 {st.absWeek + 1}/{st.totalWeeks} 周</div>
      <div className="peer-stats">
        <Mini label="班费" value={`¥${st.budget.toLocaleString()}`} />
        <Mini label="平均等级" value={stats.avgGrade} accent={GRADE_COLORS[stats.avgGrade]} />
        <Mini label="平均压力" value={`${stats.avgPressure.toFixed(0)}%`} accent={pColor} />
        <Mini label="士气" value={Math.round(st.morale ?? 0)} />
        <Mini label="成就" value={achv} />
        <Mini label="病假" value={st.students.filter((s) => s.sickWeeks > 0).length} />
      </div>
    </div>
  );
}

const Mini = ({ label, value, accent }) => (
  <div className="peer-mini">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
  </div>
);
