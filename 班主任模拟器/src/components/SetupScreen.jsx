import React, { useState, useMemo } from 'react';
import { SYSTEMS, DIFFICULTY, MODES, TIME_SCALE } from '../constants.js';
import { parseNames } from '../engine.js';
import { DEFAULT_SERVER_URL } from '../net/useRoom.js';

/**
 * 开局设置：学制、时长模式、难度、人数、姓名。
 * 支持两种入口：单机（本地 reducer）与联机（连接房间，服务端结算）。
 * net 为 useRoom() 的返回值；联机时开局按钮会把意图发给服务端。
 */
export default function SetupScreen({ onStart, net }) {
  const [system, setSystem] = useState('63');
  const [mode, setMode] = useState('full');
  const [difficulty, setDifficulty] = useState('normal');
  const [x, setX] = useState(30);
  const [nameText, setNameText] = useState('');
  const [online, setOnline] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  const n = Math.max(1, Math.floor(Number(x) || 0));
  const names = useMemo(() => parseNames(nameText, n), [nameText, n]);
  const diff = DIFFICULTY[difficulty];
  const valid = Number.isFinite(Number(x)) && n >= 1 && n <= 200;
  const modeInfo = MODES[mode];

  const myPlayer = net?.online && net.players?.[net.you];
  const joined = !!net?.online;
  const connecting = net?.status === 'connecting';

  const startPayload = () => ({ system, difficulty, x: n, nameText, mode });

  return (
    <div className="setup">
      <div className="setup-card card">
        <div className="setup-hero">
          <div className="hero-icon">🎓</div>
          <h1>班主任模拟器</h1>
          <p className="muted">带好每一个学生，见证他们从 F 走到 SSSS+ ！</p>
        </div>

        <div className="field">
          <label>入口</label>
          <div className="seg wide">
            <button className={!online ? 'on' : ''} onClick={() => setOnline(false)}>🧑‍🏫 单机</button>
            <button className={online ? 'on' : ''} onClick={() => setOnline(true)}>🌐 联机（2 人同房）</button>
          </div>
        </div>

        {online && (
          <div className="field net-box">
            <label>联机房间</label>
            {!joined ? (
              <>
                <div className="net-row">
                  <input
                    placeholder="房间号，如 class01"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                  />
                  <input
                    placeholder="你的昵称"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                </div>
                <input
                  placeholder="服务端地址 ws://…"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
                <button
                  className="btn-primary"
                  disabled={!roomCode.trim() || connecting}
                  onClick={() => net.connect(serverUrl.trim(), roomCode.trim(), playerName.trim())}
                >
                  {connecting ? '连接中…' : '连接房间'}
                </button>
                <small className="muted">需先在本机运行服务端：<code>npm run server</code>（详见 README）。</small>
              </>
            ) : (
              <div className="room-status">
                <div>
                  已加入房间 <b>{net.room}</b> · 你是 {net.you + 1} 号玩家
                  <button className="btn-small" style={{ marginLeft: 8 }} onClick={net.disconnect}>离开房间</button>
                </div>
                <div className="room-players">
                  {net.players.map((p) => (
                    <div key={p.slot} className={`room-player ${p.slot === net.you ? 'me' : ''}`}>
                      <b>{p.slot + 1}. {p.name || '（等待中）'}</b>
                      <span className="muted">
                        {!p.connected ? '未连接' : p.state ? `已开局 · ${p.state.students.length} 人` : '未开局'}
                      </span>
                    </div>
                  ))}
                </div>
                {net.players.every((p) => !p.connected || !p.name) && (
                  <small className="muted">等待另一位玩家加入同一房间号…</small>
                )}
                {net.error && <small className="danger">{net.error}</small>}
              </div>
            )}
          </div>
        )}

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
          <label>时长模式</label>
          <div className="seg wide">
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>
                {m.name}
              </button>
            ))}
          </div>
          <small className="muted">
            {modeInfo.desc}；学习增幅 ×{TIME_SCALE[mode]}（时间越短，成长越快）。
          </small>
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
          disabled={!valid || (online && !joined) || (online && !!myPlayer?.state)}
          onClick={() => onStart(startPayload())}
        >
          {online && myPlayer?.state ? '已开局，等待服务端同步…' : '🚀 开始班级生活'}
        </button>
      </div>
    </div>
  );
}
