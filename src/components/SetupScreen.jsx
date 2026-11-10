import React, { useState, useMemo } from 'react';
import { SYSTEMS, DIFFICULTY } from '../constants.js';
import { parseNames } from '../engine.js';

/** 开局设置：学制、难度、人数、姓名 */
export default function SetupScreen({ onStart }) {
  const [system, setSystem] = useState('63');
  const [difficulty, setDifficulty] = useState('normal');
  const [x, setX] = useState(30);
  const [nameText, setNameText] = useState('');

  const n = Math.max(1, Math.floor(Number(x) || 0));
  const names = useMemo(() => parseNames(nameText, n), [nameText, n]);
  const diff = DIFFICULTY[difficulty];
  const valid = Number.isFinite(Number(x)) && n >= 1 && n <= 200;

  return (
    <div className="setup">
      <div className="setup-card card">
        <div className="setup-hero">
          <div className="hero-icon">🎓</div>
          <h1>班主任模拟器</h1>
          <p className="muted">带好每一个学生，见证他们从 F 走到 SSSS+ ！</p>
        </div>

        <div className="field">
          <label>学制</label>
          <div className="seg wide">
            {Object.entries(SYSTEMS).map(([k, v]) => (
              <button key={k} className={system === k ? 'on' : ''} onClick={() => setSystem(k)}>
                {v.name}（{v.years.length} 年）
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>难度</label>
          <div className="diff-grid">
            {Object.entries(DIFFICULTY).map(([k, d]) => (
              <button key={k} className={`diff ${difficulty === k ? 'on' : ''}`} onClick={() => setDifficulty(k)}>
                <b>{d.name}</b>
                <small>开局 {d.startLabel}</small>
                <small>周收入 {d.incomeLabel}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>学生人数 x（建议 20–60）</label>
          <input
            type="number"
            min={1}
            max={200}
            value={x}
            onChange={(e) => setX(e.target.value)}
          />
          <small className="muted">
            开局班费 ¥{diff.start(n).toLocaleString()}，周收入 ¥{diff.income(n).toLocaleString()}
          </small>
        </div>

        <div className="field">
          <label>学生姓名（逗号或换行分隔，不足自动补「学生N」）</label>
          <textarea
            rows={4}
            placeholder="张三, 李四&#10;王五"
            value={nameText}
            onChange={(e) => setNameText(e.target.value)}
          />
          <small className="muted">预览：{names.slice(0, 8).join('、')}{names.length > 8 ? ' …' : ''}</small>
        </div>

        <button
          className="btn-primary big"
          disabled={!valid}
          onClick={() => onStart({ system, difficulty, x: n, nameText })}
        >
          🚀 开始班级生活
        </button>
      </div>
    </div>
  );
}
