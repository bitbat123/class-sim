import React from 'react';
import { SUBJECTS, GRADE_COLORS, TRAIT_BY_ID } from '../constants.js';
import { gradeOf } from '../engine.js';
import { pressureColor } from './colors.js';

/** 学生卡片：姓名、特质、9 科等级色块、压力条、考试总分/排名 */
export default function StudentCard({ student, examRow }) {
  const pc = pressureColor(student.pressure);
  return (
    <div className="student-card">
      <div className="sc-head">
        <span className="sc-name">{student.name}</span>
        {examRow ? (
          <span className="sc-rank" title={examRow.examTitle}>
            班#{examRow.classRank} · 校#{examRow.schoolRank}
          </span>
        ) : (
          <span className="sc-rank muted">未考试</span>
        )}
      </div>

      <div className="traits">
        {student.sickWeeks > 0 && (
          <span className="trait sick" title="生病中：学习效果减半，每周能力下降">
            🤒 病假 {student.sickWeeks} 周
          </span>
        )}
        {student.traits.length === 0 ? (
          <span className="trait neutral">普通</span>
        ) : (
          student.traits.map((id) => {
            const t = TRAIT_BY_ID[id];
            return (
              <span key={id} className={`trait ${t.good ? 'good' : 'bad'}`} title={t.desc}>
                {t.icon} {t.name}
              </span>
            );
          })
        )}
      </div>

      <div className="grade-grid">
        {SUBJECTS.map((s) => {
          const g = gradeOf(student.mastery[s.key]);
          return (
            <div
              key={s.key}
              className="grade-chip"
              style={{ background: GRADE_COLORS[g] }}
              title={`${s.name}：${g}（熟练度 ${student.mastery[s.key].toFixed(0)}，天赋 ×${student.aptitude[s.key]}）`}
            >
              <span className="gc-sub">{s.short}</span>
              <span className="gc-g">{g}</span>
            </div>
          );
        })}
      </div>

      <div className="pressure">
        <div className="pressure-top">
          <span>压力</span>
          <span style={{ color: pc }}>{student.pressure.toFixed(0)}%</span>
        </div>
        <div className="pressure-track">
          <div
            className="pressure-fill"
            style={{ width: `${Math.min(100, student.pressure / 2.5)}%`, background: pc }}
          />
        </div>
      </div>

      {examRow && (
        <div className="sc-total">
          总分 <strong>{examRow.total}</strong> / {examRow.max}
        </div>
      )}
    </div>
  );
}
