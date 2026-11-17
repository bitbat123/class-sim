import React, { useEffect, useState } from 'react';
import { useBombRoom } from '../useBombRoom.js';
import CodeEditor from './CodeEditor.jsx';
import Board from './Board.jsx';
import { DEFAULT_CODE } from '../starters.js';

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const PHASE_TEXT = {
  coding: '编写代码中',
  consent: '等待双方确认开始',
  playing: '对局进行中',
  finished: '比赛结束',
};

/** 联机模式：输入房间号 → 编写代码 → 双方确认 → 三局两胜 */
export default function OnlineMode() {
  const room = useBombRoom();
  const [roomId, setRoomId] = useState('');
  const [seat, setSeat] = useState('player1');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [lastSent, setLastSent] = useState('');

  // 代码变化后防抖同步到服务端（只发代码，判定仍在服务端）
  useEffect(() => {
    if (!room.joined) return;
    const t = setTimeout(() => {
      if (code !== lastSent) {
        room.sendCode(code);
        setLastSent(code);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [code, room.joined, lastSent]);

  if (!room.joined) {
    return (
      <div className="join-box">
        <h2>加入联机对局</h2>
        <p className="muted small">
          两人需要在同一个房间号。服务端默认地址 <code>{room.WS_URL}</code>。
        </p>
        <label>房间号</label>
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="例如 3ban-final" />
        <label>座位</label>
        <select value={seat} onChange={(e) => setSeat(e.target.value)}>
          <option value="player1">玩家 1</option>
          <option value="player2">玩家 2</option>
        </select>
        <button
          className="btn-primary"
          disabled={!roomId}
          onClick={() => room.connect(roomId, seat)}
        >
          连接并加入
        </button>
        {room.error && <div className="errors">{room.error}</div>}
        {room.logs.length > 0 && (
          <div className="log-box">
            {room.logs.map((l, i) => <div key={i} className="log-item">{l}</div>)}
          </div>
        )}
      </div>
    );
  }

  const view = room.view;
  const snap = view?.round ?? null;
  const phase = view?.phase;

  return (
    <div className="online">
      <div className="online-head">
        <div>
          <b>房间 {room.joined.room}</b>
          <span className="muted small"> · 你是{room.joined.player === 'player1' ? '玩家 1' : '玩家 2'}</span>
        </div>
        <div className="online-status">
          <span className={`dot-live ${room.connected ? 'on' : 'off'}`} />
          {room.connected ? '已连接' : '已断开'}
          {view && <span className="muted small"> · {PHASE_TEXT[phase]}</span>}
        </div>
        {phase === 'coding' && view && (
          <div className="timer">剩余 {fmt(view.codingLeftMs)}</div>
        )}
        <button className="btn-small" onClick={view?.paused ? room.resume : room.pause} disabled={phase !== 'coding' && phase !== 'playing'}>
          {view?.paused ? '继续' : '暂停'}
        </button>
      </div>

      {view?.paused && <div className="paused-banner">⏸ 比赛已暂停，时间不走动</div>}

      <div className="online-body">
        <div className="online-editor">
          <CodeEditor value={code} onChange={setCode} readOnly={phase !== 'coding'} height="420px" />
          {room.errors?.length > 0 && (
            <div className="errors">
              {room.errors.map((e, i) => <div key={i}>第 {e.line} 行：{e.message}</div>)}
            </div>
          )}
          {room.errors?.length === 0 && <div className="ok-line">✅ 代码已通过检查</div>}
        </div>

        <div className="online-board">
          <Board snapshot={snap} title={snap ? `第 ${snap.turn} 回合` : '等待开局'} />
          {view?.series && (
            <div className="result-box">
              总比分 {view.series.wins.player1} : {view.series.wins.player2}
              {view.series.over && <b> · {view.series.winner === 'player1' ? '玩家1 获胜' : view.series.winner === 'player2' ? '玩家2 获胜' : '平局'}</b>}
            </div>
          )}
          {phase === 'consent' && (
            <button className="btn-primary" onClick={room.consent}>
              ✅ 同意开始本局
            </button>
          )}
          {phase === 'finished' && (
            <button className="btn-small" onClick={room.requestReplay}>📼 查看录像</button>
          )}
        </div>
      </div>

      {room.replay && (
        <div className="replay-panel">
          <h3>录像（{room.replay.replay.length} 条记录）</h3>
          <div className="log-list">
            {room.replay.replay.slice(-40).map((r, i) => (
              <div key={i} className="log-item">
                {r.type === 'turn' ? `回合 ${r.turn}` : r.type === 'round-end' ? `本局结束：${r.result}` : r.type === 'match-end' ? `整场结束：${r.winner}` : `开始第 ${r.round} 局（地图 ${r.mapIndex + 1}）`}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="log-box">
        <h3>消息</h3>
        <div className="log-list">
          {room.logs.map((l, i) => <div key={i} className="log-item">{l}</div>)}
        </div>
      </div>
    </div>
  );
}
