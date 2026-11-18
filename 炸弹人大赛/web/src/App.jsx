import React, { useEffect, useState } from 'react';
import { STARTERS, DEFAULT_CODE } from './starters.js';
import { BASELINES } from '@shared/baselines.js';
import { runLocalMatch, SPEED_MS } from './localMatch.js';
import { checkCode } from '@shared/interp.js';
import CodeEditor from './components/CodeEditor.jsx';
import Board from './components/Board.jsx';
import OnlineMode from './components/OnlineMode.jsx';
import DocsPanel from './components/DocsPanel.jsx';
import { BOMB_API } from './apiData.js';

export default function App() {
  const [mode, setMode] = useState('local'); // local | online
  const [code, setCode] = useState(DEFAULT_CODE);
  const [errors, setErrors] = useState([]);
  const [opponent, setOpponent] = useState('medium');
  const [mapIndex, setMapIndex] = useState(0);
  const [playback, setPlayback] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  // 语法检查（防抖，避免每次按键都解析一遍）
  useEffect(() => {
    const t = setTimeout(() => setErrors(checkCode(code)), 350);
    return () => clearTimeout(t);
  }, [code]);

  // 回放逐帧推进
  useEffect(() => {
    if (!playing || !playback) return;
    const t = setTimeout(() => {
      setCursor((c) => {
        if (c + 1 >= playback.frames.length) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, SPEED_MS);
    return () => clearTimeout(t);
  }, [playing, playback, cursor]);

  const startLocal = () => {
    const res = runLocalMatch(code, BASELINES[opponent].src, mapIndex);
    if (res.error) {
      setErrors([{ line: 1, message: res.error }]);
      return;
    }
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
          <span className="logo">💣</span>
          <div>
            <h1>C++ 炸弹人程序大赛</h1>
            <small>编写炸弹人 AI，让它自己打仗</small>
          </div>
        </div>
        <div className="mode-tabs">
          <button className={mode === 'local' ? 'on' : ''} onClick={() => setMode('local')}>🤖 打基准程序</button>
          <button className={mode === 'online' ? 'on' : ''} onClick={() => setMode('online')}>🌐 联机对战</button>
        </div>
        <div className="top-actions">
          {mode === 'local' && (
            <>
              <select value={opponent} onChange={(e) => setOpponent(e.target.value)} aria-label="对手">
                {Object.entries(BASELINES).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
              <select value={mapIndex} onChange={(e) => setMapIndex(Number(e.target.value))} aria-label="地图">
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i}>地图 {i + 1}</option>
                ))}
              </select>
              <button className="btn-primary" onClick={startLocal}>▶ 与基准程序对战</button>
            </>
          )}
        </div>
      </header>

      <DocsPanel api={BOMB_API} />

      {mode === 'online' ? (
        <OnlineMode />
      ) : (
      <main className="layout">
        <section className="col-editor">
          <div className="panel-head">
            <h2>我的程序</h2>
            <select
              defaultValue="default"
              aria-label="载入模板"
              onChange={(e) => setCode(STARTERS.find((s) => s.id === e.target.value).src)}
            >
              {STARTERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="rules-note">
            <b>与普通 C++ 不同的地方：</b>
            必须写 <code>#include&lt;bomb.h&gt;</code>，不能引入 iostream 等输入输出头文件；
            没有 std / 字符串 / 指针；访问游戏状态一律加 <code>bomb::</code> 前缀；
            只能改 <code>bomb::player_dir</code> 和 <code>bomb::player_bomb</code>，其余全部只读；
            每回合调用一次 <code>void main()</code>，单次运行超过 <b>50ms</b> 判超时。
          </div>

          <CodeEditor value={code} onChange={setCode} height="440px" />

          {errors.length > 0 ? (
            <div className="errors">
              {errors.map((e, i) => <div key={i}>第 {e.line} 行：{e.message}</div>)}
            </div>
          ) : (
            <div className="ok-line">✅ 语法检查通过</div>
          )}
        </section>

        <section className="col-board">
          <Board
            snapshot={snap}
            title={playback ? `对战回放（${cursor}/${playback.frames.length - 1}）` : '棋盘'}
          />

          {playback && (
            <div className="playback-bar">
              <button className="btn-small" onClick={() => setCursor(0)}>⏮</button>
              <button className="btn-small" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ 暂停' : '▶ 播放'}</button>
              <input
                type="range"
                min={0}
                max={playback.frames.length - 1}
                value={cursor}
                onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }}
                aria-label="回放进度"
              />
              <span className="muted small">{cursor}/{playback.frames.length - 1}</span>
            </div>
          )}

          {playback && (
            <div className="result-box">
              结果：<b>{playback.result === 'player1' ? '我赢了' : playback.result === 'player2' ? '基准程序赢' : '平局'}</b>
              <span className="muted"> · 共 {playback.turns} 回合</span>
            </div>
          )}

          <div className="log-box">
            <h3>事件</h3>
            <div className="log-list">
              {(frame?.snapshot?.events || []).map((e, i) => <div key={i} className="log-item">{e}</div>)}
              {frame?.errors?.player1 && <div className="log-item err">我：{frame.errors.player1.error}</div>}
              {frame?.errors?.player2 && <div className="log-item err">对手：{frame.errors.player2.error}</div>}
              {!frame && <div className="muted small">还没有开始对战。</div>}
            </div>
          </div>
        </section>
      </main>
      )}
    </div>
  );
}
