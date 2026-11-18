import React, { useCallback, useEffect, useRef, useState } from 'react';
import { callAuth, getToken } from './cloud.js';
import { renderMarkdown, renderPlain } from './markdown.js';

const POLL_MS = 1500;

/**
 * 全屏聊天页：
 * - 左侧会话列表（公共频道 + 每个成员私聊）
 * - 右侧消息流
 * - Enter 换行，Ctrl+Enter 发送
 * - 可选 Markdown / 纯文本
 */
export default function App() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState('public');
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [body, setBody] = useState('');
  const [format, setFormat] = useState('markdown');
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const listRef = useRef(null);
  const taRef = useRef(null);

  // 校验登录状态
  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    callAuth('session', { token })
      .then((r) => { if (r.ok) setMe(r.username); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // 成员列表（用于私聊）
  useEffect(() => {
    if (!me) return;
    callAuth('listMembers')
      .then((r) => { if (r.ok) setMembers(r.users || []); })
      .catch(() => {});
  }, [me]);

  const fetchMessages = useCallback(async (reset) => {
    if (!me) return;
    try {
      const payload = reset ? {} : { after: lastIdRef.current, limit: 80 };
      if (mode !== 'public') payload.to = mode;
      const r = await callAuth('chatFetch', payload);
      if (!r.ok) { setErr(r.message); return; }
      setErr(null);
      const list = r.messages || [];
      if (reset) {
        lastIdRef.current = 0;
        setMessages(list);
      } else if (list.length) {
        setMessages((m) => [...m, ...list]);
      }
      const last = list[list.length - 1];
      if (last) lastIdRef.current = Math.max(lastIdRef.current, Number(last.id));
    } catch (e) {
      setErr(e.message);
    }
  }, [mode, me]);

  useEffect(() => {
    setMessages([]);
    lastIdRef.current = 0;
    fetchMessages(true);
  }, [mode, fetchMessages]);

  useEffect(() => {
    const t = setInterval(() => fetchMessages(false), POLL_MS);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  // 页面在聊天页时，清掉未读角标
  useEffect(() => {
    if (window.DSHChat) window.DSHChat.setUnread(0);
    document.title = '聊天室 · 中预三班';
  }, [messages.length]);

  const send = async () => {
    const text = body;
    if (!text.trim() || sending) return;
    setSending(true);
    setErr(null);
    try {
      const r = await callAuth('chatSend', {
        body: text,
        format,
        ...(mode === 'public' ? {} : { to: mode }),
      });
      if (!r.ok) { setErr(r.message); return; }
      setBody('');
      lastIdRef.current = 0;
      await fetchMessages(true);
      taRef.current?.focus();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (!e.nativeEvent.isComposing) send();
    }
  };

  if (checking) {
    return <div className="chat-full"><p className="muted center">加载中…</p></div>;
  }

  if (!me) {
    return (
      <div className="chat-full">
        <div className="need-login">
          <h1>💬 聊天室</h1>
          <p>请先在主页登录，再打开这个页面。</p>
          <a className="btn-primary" href="/">回主页登录</a>
        </div>
      </div>
    );
  }

  const peers = members.filter((u) => u.username !== me);

  return (
    <div className="chat-full">
      <aside className="chat-nav">
        <div className="chat-nav-head">
          <h1>💬 聊天室</h1>
          <span className="muted small">{me}</span>
        </div>
        <button className={`conv ${mode === 'public' ? 'on' : ''}`} onClick={() => setMode('public')}>
          🌐 公共频道
        </button>
        <div className="chat-nav-title">成员私聊（{peers.length}）</div>
        <div className="conv-list">
          {peers.map((u) => (
            <button key={u.username} className={`conv ${mode === u.username ? 'on' : ''}`} onClick={() => setMode(u.username)}>
              <span>{u.username}</span>
              <small className="muted">{u.studentId} 号</small>
            </button>
          ))}
        </div>
        <a className="back-home" href="/">← 回主页</a>
      </aside>

      <main className="chat-pane">
        <header className="chat-pane-head">
          <h2>{mode === 'public' ? '🌐 公共频道（所有人可见）' : `🔒 与 ${mode} 的私聊`}</h2>
          <span className="muted small">Enter 换行 · Ctrl+Enter 发送</span>
        </header>

        <div className="chat-stream" ref={listRef}>
          {messages.length === 0 && <p className="muted">还没有消息。</p>}
          {messages.map((m) => (
            <article key={m.id} className={`msg ${m.sender === me ? 'mine' : ''}`}>
              <div className="msg-head">
                <b>{m.sender}</b>
                <span className="muted small">
                  {m.format === 'plain' && <em className="plain-tag">纯文本</em>}
                  {m.at ? new Date(Number(m.at)).toLocaleString('zh-CN', { hour12: false }) : ''}
                </span>
              </div>
              <div
                className="msg-body"
                dangerouslySetInnerHTML={{ __html: m.format === 'plain' ? renderPlain(m.body) : renderMarkdown(m.body) }}
              />
            </article>
          ))}
        </div>

        {err && <div className="chat-error">{err}</div>}

        <footer className="chat-compose">
          <div className="format-row">
            <label><input type="radio" checked={format === 'markdown'} onChange={() => setFormat('markdown')} /> Markdown</label>
            <label><input type="radio" checked={format === 'plain'} onChange={() => setFormat('plain')} /> 纯文本</label>
          </div>
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={format === 'markdown' ? '输入 Markdown，Ctrl+Enter 发送' : '输入纯文本，Ctrl+Enter 发送'}
            rows={4}
          />
          <div className="compose-actions">
            <span className="muted small">{body.length} / 2000</span>
            <button className="btn-primary" onClick={send} disabled={!body.trim() || sending}>
              {sending ? '发送中…' : '发送（Ctrl+Enter）'}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
