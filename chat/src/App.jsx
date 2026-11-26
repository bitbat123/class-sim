import React, { useCallback, useEffect, useRef, useState } from 'react';
import { callAuth, getToken } from './cloud.js';
import { renderMarkdown, renderPlain } from './markdown.js';

const POLL_MS = 1500;
const MAX_TEXT = 20000;      // 单条消息最多 20000 字
const MAX_FILES = 6;         // 一条消息最多 6 个文件
const MAX_FILE_BYTES = 900 * 1024;

/** 人类可读的文件大小 */
function fmtSize(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 把 File 读成 base64（去掉 data:...;base64, 前缀） */
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

/** 触发浏览器下载 base64 内容 */
function downloadBase64(name, mime, b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 是不是图片（可以在线预览） */
const isImage = (mime) => /^image\//.test(mime || '');

/**
 * 全屏聊天页：
 * - 左侧会话列表（公共频道 + 每个成员私聊）
 * - 右侧消息流
 * - Enter 换行，Ctrl+Enter 发送
 * - 可选 Markdown / 纯文本
 * - 支持附件（最大 900KB，最多 6 个）
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
  const [attachments, setAttachments] = useState([]);   // [{name, mime, size, data}]
  const lastIdRef = useRef(0);
  const listRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);

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
    if ((!body.trim() && !attachments.length) || sending) return;
    setSending(true);
    setErr(null);
    try {
      const r = await callAuth('chatSend', {
        body,
        format,
        attachments: attachments.map((a) => ({ name: a.name, mime: a.mime, size: a.size, data: a.data })),
        ...(mode === 'public' ? {} : { to: mode }),
      });
      if (!r.ok) { setErr(r.message); return; }
      setBody('');
      setAttachments([]);
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

  /** 选择文件：读成 base64 放进待发送列表 */
  const pickFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const next = [...attachments];
    for (const f of files) {
      if (next.length >= MAX_FILES) { setErr(`最多 ${MAX_FILES} 个文件`); break; }
      if (f.size > MAX_FILE_BYTES) { setErr(`「${f.name}」超过 900KB`); continue; }
      try {
        const data = await readAsBase64(f);
        next.push({ name: f.name, mime: f.type || 'application/octet-stream', size: f.size, data });
      } catch (e) {
        setErr(e.message);
      }
    }
    setAttachments(next);
  };

  /** 下载聊天里的附件 */
  const download = async (f) => {
    try {
      const r = await callAuth('chatFile', { id: f.id });
      if (!r.ok) { setErr(r.message); return; }
      downloadBase64(r.file.name, r.file.mime, r.file.data);
    } catch (e) {
      setErr(e.message);
    }
  };

  /** 预览图片附件 */
  const preview = async (f) => {
    try {
      const r = await callAuth('chatFile', { id: f.id });
      if (!r.ok) { setErr(r.message); return; }
      const bin = atob(r.file.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: r.file.mime });
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (e) {
      setErr(e.message);
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
          <span className="muted small">Enter 换行 · Ctrl+Enter 发送 · 可发文件</span>
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

              {m.body && (
                <div
                  className="msg-body"
                  dangerouslySetInnerHTML={{ __html: m.format === 'plain' ? renderPlain(m.body) : renderMarkdown(m.body) }}
                />
              )}

              {Array.isArray(m.files) && m.files.length > 0 && (
                <div className="msg-files">
                  {m.files.map((f) => (
                    <button
                      key={f.id}
                      className="file-chip"
                      onClick={() => (isImage(f.mime) ? preview(f) : download(f))}
                      title={isImage(f.mime) ? '点击预览' : '点击下载'}
                    >
                      <span className="file-icon">{isImage(f.mime) ? '🖼' : '📄'}</span>
                      <span className="file-name">{f.name}</span>
                      <span className="muted small">{fmtSize(f.size)}</span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>

        {err && <div className="chat-error">{err}</div>}

        <footer className="chat-compose">
          <div className="format-row">
            <label><input type="radio" checked={format === 'markdown'} onChange={() => setFormat('markdown')} /> Markdown</label>
            <label><input type="radio" checked={format === 'plain'} onChange={() => setFormat('plain')} /> 纯文本</label>
          </div>

          {attachments.length > 0 && (
            <div className="attach-list">
              {attachments.map((a, i) => (
                <span key={`${a.name}-${i}`} className="attach-chip">
                  📎 {a.name} <small className="muted">{fmtSize(a.size)}</small>
                  <button
                    className="attach-x"
                    onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
                    aria-label="移除"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={format === 'markdown' ? '输入 Markdown，Ctrl+Enter 发送' : '输入纯文本，Ctrl+Enter 发送'}
            rows={4}
            maxLength={MAX_TEXT}
          />

          <div className="compose-actions">
            <span className="muted small">
              {body.length} / {MAX_TEXT}
              {attachments.length > 0 && ` · ${attachments.length}/${MAX_FILES} 个文件`}
            </span>
            <div className="compose-btns">
              <button className="btn-small" onClick={() => fileRef.current?.click()} disabled={sending || attachments.length >= MAX_FILES}>
                📎 加文件
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }}
              />
              <button className="btn-primary" onClick={send} disabled={(!body.trim() && !attachments.length) || sending}>
                {sending ? '发送中…' : '发送（Ctrl+Enter）'}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
