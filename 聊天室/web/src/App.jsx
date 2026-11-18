import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from './useChat.js';
import { renderMarkdown } from './markdown.js';
import { validateName, validateText, isSendShortcut, MAX_MESSAGE_LENGTH } from './validate.js';

const PUBLIC = { kind: 'public' };

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function Message({ msg, me }) {
  const html = useMemo(() => renderMarkdown(msg.text), [msg.text]);
  const mine = msg.from === me;
  return (
    <div className={`msg ${mine ? 'mine' : ''} ${msg.type === 'private' ? 'private' : ''}`}>
      <div className="msg-meta">
        <span className="msg-from">{msg.from}</span>
        {msg.type === 'private' && (
          <span className="msg-tag">私聊 → {mine ? msg.to : '我'}</span>
        )}
        <span className="msg-time">{formatTime(msg.ts)}</span>
      </div>
      {/* html is produced by renderMarkdown, which sanitizes with DOMPurify. */}
      <div className="msg-body markdown" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function NameScreen({ onJoin, status, error, setError }) {
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState(null);
  const busy = status === 'connecting';

  const submit = (e) => {
    e.preventDefault();
    const err = validateName(name);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    setError(null);
    onJoin(name.trim());
  };

  return (
    <div className="join-screen">
      <form className="join-card" onSubmit={submit}>
        <h1>聊天室</h1>
        <p className="hint">输入一个昵称加入聊天（1-20 个字符，不能重复）。</p>
        <label>
          昵称
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="你的昵称"
            disabled={busy}
          />
        </label>
        {(localError || error) && <div className="error">{localError || error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? '连接中…' : '加入'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const chat = useChat();
  const { status, me, users, publicMessages, privateMessages, error, setError } = chat;
  const [view, setView] = useState(PUBLIC); // PUBLIC or { kind:'private', peer }
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState(null);
  const listRef = useRef(null);

  const joined = status === 'open' && me;
  const peers = users.filter((u) => u !== me);

  const current = view.kind === 'private' ? privateMessages[view.peer] || [] : publicMessages;

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current.length, view]);

  // If the private peer goes offline, keep the conversation visible but mark the view.
  const peerOnline = view.kind === 'private' && users.includes(view.peer);

  const sendCurrent = () => {
    const err = validateText(draft);
    if (err) {
      setSendError(err);
      return;
    }
    setSendError(null);
    const ok =
      view.kind === 'private'
        ? chat.send({ type: 'private', to: view.peer, text: draft })
        : chat.send({ type: 'public', text: draft });
    if (ok) setDraft('');
  };

  // Keyboard policy:
  //   Enter        -> newline (default textarea behaviour, never sends)
  //   Ctrl+Enter   -> send
  const onKeyDown = (e) => {
    if (isSendShortcut(e)) {
      e.preventDefault();
      sendCurrent();
    }
  };

  if (!joined) {
    return (
      <NameScreen
        onJoin={chat.connect}
        status={status}
        error={error}
        setError={setError}
      />
    );
  }

  const title =
    view.kind === 'private' ? `与 ${view.peer} 的私聊` : '公共聊天室';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="me">
          当前用户：<strong>{me}</strong>
          <button className="link" onClick={chat.disconnect}>退出</button>
        </div>
        <div className="section-title">公共聊天室</div>
        <button
          className={`room-btn ${view.kind === 'public' ? 'active' : ''}`}
          onClick={() => setView(PUBLIC)}
        >
          # 大厅
        </button>
        <div className="section-title">在线用户（{users.length}）</div>
        <ul className="user-list">
          {peers.length === 0 && <li className="muted">暂无其他在线用户</li>}
          {peers.map((u) => (
            <li key={u}>
              <button
                className={`user-btn ${view.kind === 'private' && view.peer === u ? 'active' : ''}`}
                onClick={() => setView({ kind: 'private', peer: u })}
              >
                {u}
                {privateMessages[u]?.length ? <span className="dot" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="chat">
        <header className="chat-header">
          <h2>{title}</h2>
          {view.kind === 'private' && !peerOnline && (
            <span className="muted">（对方已离线，无法发送）</span>
          )}
        </header>

        <div className="messages" ref={listRef}>
          {current.length === 0 && <div className="muted empty">还没有消息。</div>}
          {current.map((m) => (
            <Message key={m.id} msg={m} me={me} />
          ))}
        </div>

        <div className="composer">
          {(sendError || error) && <div className="error">{sendError || error}</div>}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              view.kind === 'private'
                ? `私聊给 ${view.peer}（Ctrl+Enter 发送，Enter 换行）`
                : '发送公共消息（Ctrl+Enter 发送，Enter 换行）'
            }
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH + 200}
            disabled={view.kind === 'private' && !peerOnline}
          />
          <div className="composer-foot">
            <span className="muted">
              {[...draft].length}/{MAX_MESSAGE_LENGTH} · 支持 Markdown · Ctrl+Enter 发送
            </span>
            <button
              onClick={sendCurrent}
              disabled={view.kind === 'private' && !peerOnline}
            >
              发送
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
