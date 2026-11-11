import React from 'react';
import { SUBJECTS } from '../constants.js';
import { scoreColor } from './colors.js';

/** 考试成绩单：选择考试 → 表格（分数带颜色，排名醒目） */
export default function ExamResult({ exams, exam, onSelect }) {
  if (!exams.length) {
    return (
      <div className="card empty">
        <div className="empty-icon">📭</div>
        <p>还没有考试。执行「小测验」「大考」「模拟考试」或等待月考/期中/期末。</p>
      </div>
    );
  }

  const keys = exam.keys;
  const cols = SUBJECTS.filter((s) => keys.includes(s.key));
  const rows = [...exam.rows].sort((a, b) => a.classRank - b.classRank);

  return (
    <div className="card">
      <div className="exam-head">
        <h3>📊 {exam.title}</h3>
        <span className="muted small">第 {exam.week} 周 · 班级均分率 {(exam.mean * 100).toFixed(1)}% · 全校人数 {exam.schoolSize}</span>
        <select value={exam.id} onChange={(e) => onSelect(e.target.value)}>
          {[...exams].reverse().map((e) => (
            <option key={e.id} value={e.id}>第{e.week}周 · {e.title}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table className="exam-table">
          <thead>
            <tr>
              <th>班排</th>
              <th>校排</th>
              <th>姓名</th>
              {cols.map((s) => (
                <th key={s.key}>{s.name}<small>/{s.max}</small></th>
              ))}
              <th>总分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`rank ${r.classRank <= 3 ? 'top' : ''}`}>{r.classRank}</span>
                </td>
                <td>
                  <span className="school-rank">#{r.schoolRank}</span>
                </td>
                <td className="name">{r.name}</td>
                {cols.map((s) => (
                  <td key={s.key}>
                    <span className="score" style={{ color: scoreColor(r.scores[s.key], s.max) }}>
                      {r.scores[s.key]}
                    </span>
                  </td>
                ))}
                <td>
                  <strong>{r.total}</strong>
                  <small className="muted"> /{r.max}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
