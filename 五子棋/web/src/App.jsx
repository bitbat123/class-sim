import React, { useEffect, useState } from 'react';
import { STARTERS, DEFAULT_CODE } from './starters.js';
import { runLocalGame, SPEED_MS } from './localGame.js';
import { checkCode } from '@shared/game.js';
import { BASELINES } from '@shared/baselines.js';
import CodeEditor from './components/CodeEditor.jsx';
import Board from './components/Board.jsx';
import DocsPanel from './components/DocsPanel.jsx';
import { GO_API } from './apiData.js';

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [errors, setErrors] = useState([]);
  const [opponent, setOpponent] = useState('mid');
  const [myColor, setMyColor] = useState('black');
  const [playback, setPlayback] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setErrors(checkCode(code)), 350);
    return () => clearTimeout(t);
  }, [code]);

  useEffect(() => {
    if (!playing || !playback) return;
    const t = setTimeout(() => {
      setCursor((c) => {
        if (c + 1 >= playback.frames.length) { setPlaying(false); return c; }
        return c + 1;
      });
    }, SPEED_MS);
    return () => clearTimeout(t);
  }, [playing, playback, cursor]);

  const start = () => {
    const res = runLocalGame(code, opponent, myColor);
    if (res.error) { setErrors([{ line: 1, message: res.error }]); return; }
    setPlayback(res);
    setCursor(0);
    setPlaying(true);
  };

  const frame = playback?.frames[cursor];
  const snap = frame?.snapshot ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⚫</span>
          <div>
            <h1>C++ 五子棋程序大赛</h1>
            <small>写一段类 C++ 代码，让它替你落子</small>
          </div>
        </div>
        <div className="top-actions">
          <select value={myColor} onChange={(e) => setMyColor(e.target.value)} aria-label="我方执棋">
            <option value="black">我执黑（先手）</option>
            <option value="white">我执白（后手）</option>
          </select>
          <select value={opponent} onChange={(e) => setOpponent(e.target.value)} aria-label="对手">
            {Object.entries(BASELINES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          <button className="btn-primary" onClick={start}>▶ 与基准程序对局</button>
        </div>
      </header>

      <DocsPanel api={GO_API} />

      <main className="layout">
        <section className="col-editor">
          <div className="panel-head">
            <h2>我的程序</h2>
            <select defaultValue="default" aria-label="载入模板" onChange={(e) => setCode(STARTERS.find((s) => s.id === e.target.value).src)}>
              {STARTERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="rules-note">
            <b>与普通 C++ 不同的地方：</b>
            必须写 <code>#include&lt;go.h&gt;</code>，不能引入 iostream 等头文件；
            没有 std / 字符串 / 指针；局面一律用 <code>go::</code> 前缀读取；
            只能写 <code>go::move_x</code> 和 <code>go::move_y</code>，其余全部只读；
            每回合调用一次 <code>void main()</code>，单次超过 <b>50ms</b> 判超时；
            违规落子（重复、越界）累计 3 次即判负。
          </div>

          <CodeEditor value={code} onChange={setCode} height="430px" />

          {errors.length > 0
            ? <div className="errors">{errors.map((e, i) => <div key={i}>第 {e.line} 行：{e.message}</div>)}</div>
            : <div className="ok-line">✅ 语法检查通过</div>}
        </section>

        <section className="col-board">
          <Board snapshot={snap} title={playback ? `对局回放（${cursor}/${playback.frames.length - 1}）` : '棋盘'} />

          {playback && (
            <div className="playback-bar">
              <button className="btn-small" onClick={() => setCursor(0)}>⏮</button>
              <button className="btn-small" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ 暂停' : '▶ 播放'}</button>
              <input type="range" min={0} max={playback.frames.length - 1} value={cursor}
                onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }} aria-label="回放进度" />
              <span className="muted small">{cursor}/{playback.frames.length - 1}</span>
            </div>
          )}

          {playback && (
            <div className="result-box">
              结果：<b>{playback.result === 'me' ? '我赢了' : playback.result === 'opponent' ? '基准程序赢' : '平局'}</b>
              <span className="muted"> · 共 {playback.moves} 手</span>
            </div>
          )}

          <div className="log-box">
            <h3>事件</h3>
            <div className="log-list">
              {(frame?.snapshot?.events || []).map((e, i) => <div key={i} className="log-item">{e}</div>)}
              {frame?.error && <div className="log-item err">{frame.error.message}</div>}
              {!frame && <div className="muted small">还没有开始对局。</div>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
