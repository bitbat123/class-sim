import React, { useReducer, useState, useMemo, useEffect } from 'react';
import { GRADE_COLORS, SUBJECTS, SYSTEMS, DIFFICULTY } from './constants.js';
import { gameReducer, parseNames, termLabel, classStats, gradeIndex } from './engine.js';
import StudentCard from './components/StudentCard.jsx';
import ActionPanel from './components/ActionPanel.jsx';
import ExamResult from './components/ExamResult.jsx';
import EventLog from './components/EventLog.jsx';
import Legend from './components/Legend.jsx';
import SetupScreen from './components/SetupScreen.jsx';
import ThemePicker from './components/ThemePicker.jsx';
import { scoreColor } from './components/colors.js';
import { THEMES, THEME_BY_ID } from './themes.js';

const newSeed = () => Math.floor(Math.random() * 4294967296);

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, null);
  const [tab, setTab] = useState('students'); // students | exam
  const [selectedExam, setSelectedExam] = useState(null);
  const [popupExam, setPopupExam] = useState(null); // 全屏成绩弹窗
  const [themeId, setThemeId] = useState(() => localStorage.getItem('theme') || 'nebula');
  // 注：THEME_BY_ID 找不到时回退到第一套主题

  useEffect(() => {
    const theme = THEME_BY_ID[themeId] || THEMES[0];
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    localStorage.setItem('theme', theme.id);
  }, [themeId]);

  // 开局
  const start = ({ system, difficulty, x, nameText }) => {
    const names = parseNames(nameText, x);
    dispatch({ type: 'START', payload: { system, difficulty, x, names, seed: newSeed() } });
    setTab('students');
    setSelectedExam(null);
  };

  if (!state) return <SetupScreen onStart={start} />;

  const stats = classStats(state);
  const exam = selectedExam
    ? state.exams.find((e) => e.id === selectedExam)
    : state.exams[state.exams.length - 1];

  return (
    <div className="app">
      <Header
        state={state}
        stats={stats}
        onReset={() => dispatch({ type: 'RESET' })}
        themeId={themeId}
        onThemeChange={setThemeId}
      />

      <main className="layout">
        <section className="col-main">
          <div className="tabs">
            <button className={tab === 'students' ? 'tab active' : 'tab'} onClick={() => setTab('students')}>
              👥 学生看板
            </button>
            <button className={tab === 'exam' ? 'tab active' : 'tab'} onClick={() => setTab('exam')}>
              📊 成绩单 {state.exams.length > 0 && <span className="badge">{state.exams.length}</span>}
            </button>
          </div>

          {tab === 'students' ? (
            <StudentGrid state={state} />
          ) : (
            <ExamResult
              exams={state.exams}
              exam={exam}
              onSelect={(id) => setSelectedExam(id)}
              students={state.students}
            />
          )}

          <Legend />

          <EventLog
            state={state}
            onDismissEvent={() => dispatch({ type: 'DISMISS_EVENT' })}
            onShowExam={(exam) => setPopupExam(exam)}
          />
        </section>

        <aside className="col-side">
          <div className="card week-card">
            <div className="week-label">{termLabel(state)}</div>
            <div className="week-progress">
              <div
                className="week-progress-bar"
                style={{ width: `${(state.absWeek / state.totalWeeks) * 100}%` }}
              />
            </div>
            <div className="week-sub">
              第 {state.absWeek + 1} / {state.totalWeeks} 周 · 剩余行动 {state.actionsLeft} 次
            </div>
            <button
              className="btn-primary big"
              onClick={() => dispatch({ type: 'END_WEEK', seed: newSeed() })}
              disabled={state.finished}
            >
              {state.finished ? '🎓 已毕业' : '⏭ 结束本周'}
            </button>
          </div>

          <ActionPanel
            state={state}
            onStudy={(payload) => dispatch({ type: 'STUDY', ...payload, seed: newSeed() })}
            onRelief={(payload) => dispatch({ type: 'RELIEF', ...payload })}
            onTreat={(payload) => dispatch({ type: 'TREAT', ...payload })}
          />

        </aside>
      </main>

      {popupExam && (
        <ExamPopup
          exam={popupExam}
          onClose={() => {
            setPopupExam(null);
            dispatch({ type: 'DISMISS_EXAM' });
          }}
        />
      )}

      {state.finished && (
        <div className="modal-mask">
          <div className="modal card">
            <h2>🎓 毕业典礼</h2>
            <p>三年（或六年）的班主任生涯圆满结束！</p>
            <button className="btn-primary" onClick={() => dispatch({ type: 'RESET' })}>重新开始</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 全屏考试成绩弹窗 ---------------- */
function ExamPopup({ exam, onClose }) {
  const cols = SUBJECTS.filter((s) => exam.keys.includes(s.key));
  const rows = [...exam.rows].sort((a, b) => a.classRank - b.classRank);
  return (
    <div className="exam-popup-mask">
      <div className="exam-popup card">
        <div className="exam-popup-head">
          <h2>📊 {exam.title}</h2>
          <span className="muted">第 {exam.week} 周 · 班级均分率 {(exam.mean * 100).toFixed(1)}% · 全校人数 {exam.schoolSize}</span>
        </div>
        <div className="exam-popup-body">
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
                  <td><span className={`rank ${r.classRank <= 3 ? 'top' : ''}`}>{r.classRank}</span></td>
                  <td><span className="school-rank">#{r.schoolRank}</span></td>
                  <td className="name">{r.name}</td>
                  {cols.map((s) => (
                    <td key={s.key}>
                      <span className="score" style={{ color: scoreColor(r.scores[s.key], s.max) }}>{r.scores[s.key]}</span>
                    </td>
                  ))}
                  <td><strong>{r.total}</strong><small className="muted"> /{r.max}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="exam-popup-foot">
          <button className="btn-primary" onClick={onClose}>✅ 确认</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 顶部看板 ---------------- */
function Header({ state, stats, onReset, themeId, onThemeChange }) {
  const avgColor = GRADE_COLORS[stats.avgGrade];
  const pColor = stats.avgPressure > 100 ? '#ef4444' : stats.avgPressure > 50 ? '#f59e0b' : '#22c55e';
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">🎓</span>
        <div>
          <h1>班主任模拟器</h1>
          <small>
            {SYSTEMS[state.system].name} · {DIFFICULTY[state.difficulty].name} · {state.x} 人
          </small>
        </div>
      </div>
      <div className="stats">
        <Stat label="当前周" value={`第${state.absWeek + 1}周`} />
        <Stat label="学年学期" value={termLabel(state).split(' ')[0]} />
        <Stat label="班费余额" value={`¥${state.budget.toLocaleString()}`} accent="#fbbf24" />
        <Stat label="全班平均压力" value={`${stats.avgPressure.toFixed(0)}%`} accent={pColor} />
        <Stat label="全班平均等级" value={stats.avgGrade} accent={avgColor} />
      </div>
      <ThemePicker themeId={themeId} onChange={onThemeChange} />
      <button className="btn-ghost" onClick={onReset}>↺ 重开</button>
    </header>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
  </div>
);

/* ---------------- 学生网格 ---------------- */
function StudentGrid({ state }) {
  const [sort, setSort] = useState('id');
  const list = useMemo(() => {
    const arr = [...state.students];
    if (sort === 'pressure') arr.sort((a, b) => b.pressure - a.pressure);
    if (sort === 'grade') arr.sort((a, b) => avgIdx(b) - avgIdx(a));
    return arr;
  }, [state.students, sort]);

  return (
    <div className="card">
      <div className="grid-head">
        <h3>学生看板（{state.students.length} 人）</h3>
        <div className="seg">
          {[['id', '默认'], ['pressure', '压力↓'], ['grade', '均分↓']].map(([k, label]) => (
            <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="student-grid">
        {list.map((st) => (
          <StudentCard
            key={st.id}
            student={st}
            examRow={latestRow(state.exams, st.id)}
          />
        ))}
      </div>
    </div>
  );
}

const avgIdx = (st) =>
  SUBJECTS.reduce((a, s) => a + gradeIndex(st.mastery[s.key]), 0) / SUBJECTS.length;

const latestRow = (exams, id) => {
  for (let i = exams.length - 1; i >= 0; i--) {
    const row = exams[i].rows.find((r) => r.id === id);
    if (row) return { ...row, examTitle: exams[i].title, schoolSize: exams[i].schoolSize };
  }
  return null;
};
