import React from 'react';
import { GRADES, GRADE_COLORS, SCORE_BANDS, SCORE_BANDS_150, MASTERY_PER_GRADE } from '../constants.js';

/** 等级颜色图例 + 分数段（100 分制 / 150 分制）+ 压力颜色说明 */
export default function Legend() {
  return (
    <div className="card legend">
      <h3>🎨 图例</h3>
      <div className="legend-row">
        <span className="legend-title">评分等级（低 → 高）</span>
        <div className="legend-grades">
          {GRADES.map((g) => (
            <div key={g} className="lg-item" title={`熟练度 ${GRADES.indexOf(g) * MASTERY_PER_GRADE}+`}>
              <span className="lg-chip" style={{ background: GRADE_COLORS[g] }}>{g}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="legend-row">
        <span className="legend-title">成绩分数段（100 分制）</span>
        <div className="legend-grades">
          {SCORE_BANDS.map((b) => (
            <span key={b.label} className="lg-chip" style={{ background: b.color }}>{b.label}</span>
          ))}
        </div>
      </div>
      <div className="legend-row">
        <span className="legend-title">成绩分数段（150 分制）</span>
        <div className="legend-grades">
          {SCORE_BANDS_150.map((b) => (
            <span key={b.label} className="lg-chip" style={{ background: b.color }}>{b.label}</span>
          ))}
        </div>
      </div>
      <div className="legend-row">
        <span className="legend-title">压力颜色</span>
        <div className="legend-grades">
          <span className="lg-chip" style={{ background: '#22c55e' }}>≤50%</span>
          <span className="lg-chip" style={{ background: '#eab308' }}>≤100%</span>
          <span className="lg-chip" style={{ background: '#ef4444' }}>≤250%</span>
          <span className="lg-chip" style={{ background: '#7f1d1d' }}>崩溃</span>
        </div>
      </div>
    </div>
  );
}
