// 全站通知脚本：注入到主页与三款游戏页
// 右下角悬浮「聊天室」按钮 + 未读红点（白字数字），点击在新标签打开 /chat/
// 用户未登录时自动隐藏。
(function () {
  'use strict';

  const ENV_ID = 'interim-toucan-d4g2tnti4470549e1';
  const PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImJiZDBjZTU4LWUwNmUtNDRhZC04N2I2LWZlYWU2MjkzZmUwOSJ9.eyJpc3MiOiJodHRwczovL2ludGVyaW0tdG91Y2FuLWQ0ZzJ0bnRpNDQ3MDU0OWUxLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJpbnRlcmltLXRvdWNhbi1kNGcydG50aTQ0NzA1NDllMSIsImV4cCI6NDA5ODA3NTU5MiwiaWF0IjoxNzk0MzkyMzkyLCJub25jZSI6ImJKY04zLVN6UVFLTHdGSDNYN3NGQVEiLCJhdF9oYXNoIjoiYkpjTjMtU3pRUUtMd0ZIM1g3c0ZBUSIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJpbnRlcmltLXRvdWNhbi1kNGcydG50aTQ0NzA1NDllMSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.TTEpUSgY-NO9zDk0yADRFc1BXgTvXR9KbmIhXLAJ-PvQrgvGQMF9IpdYc-flXJRL6VqUKgrpKQO8flZyd5sDJwA5x1h_Hz94mJCr2NwxYzzXKdmmlA4H90JtSkikanfY63pdjRgoDvWGICby4z4d6bMlEurxq8axk1T7MpelcqTYcOhEWPkmT2vV-s77GGihHw16eePpg0w2ip7d8__r3lyXTEQ7AXJ4_M5aMGF6on1_zjnYXip8MUgX1Dc9GXJYooNtSUp6eJtUivCT4zgAZgEkrLAiqrNJG1UapkBeeRL7T3uLivu6rbO9ySGSzm2kAmRETEX8Q0zWHrw3hjbjtg';
  const CHAT_URL = '/class-sim/chat/';
  const POLL_MS = 2000;
  const STORE_KEY = 'dshChatUnread';
  const LAST_KEY = 'dshChatLastId';

  let app = null;
  let timer = null;
  let username = null;
  let unread = Number(sessionStorage.getItem(STORE_KEY) || 0);
  let lastId = Number(sessionStorage.getItem(LAST_KEY) || 0);
  let running = false;

  function ensureStyle() {
    if (document.getElementById('dsh-chat-style')) return;
    const st = document.createElement('style');
    st.id = 'dsh-chat-style';
    st.textContent = [
      '#dsh-chat-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:7px;',
      'padding:10px 15px;border-radius:999px;text-decoration:none;background:linear-gradient(135deg,#06b6d4,#8b5cf6);',
      "color:#fff;font:600 14px/1 'Segoe UI','Microsoft YaHei',system-ui,sans-serif;box-shadow:0 6px 20px rgba(6,182,212,.45);",
      'transition:transform .15s ease}',
      '#dsh-chat-btn:hover{transform:translateY(-2px)}',
      '#dsh-chat-btn .dsh-ico{font-size:16px}',
      '#dsh-chat-dot{position:absolute;top:-7px;right:-7px;min-width:21px;height:21px;padding:0 6px;display:grid;place-items:center;',
      'background:#ef4444;color:#fff;border-radius:999px;font-size:11px;font-weight:700;line-height:1;border:2px solid #0b1020}',
      '#dsh-chat-dot[hidden]{display:none}',
      '#dsh-chat-btn.has-unread{animation:dshPulse 1.6s ease-in-out infinite}',
      '@keyframes dshPulse{0%,100%{box-shadow:0 6px 20px rgba(6,182,212,.45)}50%{box-shadow:0 6px 28px rgba(239,68,68,.8)}}',
    ].join('');
    document.head.appendChild(st);
  }

  function button() {
    let el = document.getElementById('dsh-chat-btn');
    if (!el) {
      el = document.createElement('a');
      el.id = 'dsh-chat-btn';
      el.href = CHAT_URL;
      el.target = '_blank';
      el.rel = 'noopener';
      el.title = '打开聊天室（新标签）';
      el.innerHTML = '<span class="dsh-ico">💬</span><span>聊天室</span><span id="dsh-chat-dot" hidden></span>';
      el.addEventListener('click', () => { setUnread(0); });
      document.body.appendChild(el);
    }
    return el;
  }

  function setUnread(n) {
    unread = Math.max(0, n | 0);
    sessionStorage.setItem(STORE_KEY, String(unread));
    const dot = document.getElementById('dsh-chat-dot');
    const btn = document.getElementById('dsh-chat-btn');
    if (!dot || !btn) return;
    if (unread > 0) {
      dot.hidden = false;
      dot.textContent = unread > 99 ? '99+' : String(unread);
      btn.classList.add('has-unread');
    } else {
      dot.hidden = true;
      dot.textContent = '';
      btn.classList.remove('has-unread');
    }
  }

  async function getApp() {
    if (app) return app;
    if (!window.cloudbase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.0/cloudbase.full.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    app = window.cloudbase.init({ env: ENV_ID, accessKey: PUBLISHABLE_KEY });
    return app;
  }

  async function callAuth(action, payload) {
    const a = await getApp();
    const token = localStorage.getItem('authToken') || '';
    const data = Object.assign({ action }, payload || {}, token ? { token } : {});
    const res = await a.callFunction({ name: 'auth', data });
    return res.result;
  }

  async function poll() {
    if (running) return;
    running = true;
    try {
      const r = await callAuth('chatFetch', { after: lastId, limit: 50 });
      if (r && r.ok && r.messages && r.messages.length) {
        const list = r.messages;
        const last = list[list.length - 1];
        lastId = Math.max(lastId, Number(last.id) || 0);
        sessionStorage.setItem(LAST_KEY, String(lastId));
        const incoming = list.filter((m) => m.sender !== username).length;
        if (incoming > 0) setUnread(unread + incoming);
      }
    } catch { /* 静默失败，下次再试 */ }
    running = false;
  }

  async function init() {
    ensureStyle();
    const btn = button();
    setUnread(unread);
    const token = localStorage.getItem('authToken');
    if (!token) { btn.style.display = 'none'; return; }
    try {
      const r = await callAuth('session', { token });
      if (!r || !r.ok) { btn.style.display = 'none'; return; }
      username = r.username;
    } catch {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = 'flex';
    poll();
    timer = setInterval(poll, POLL_MS);
  }

  window.DSHNotify = { setUnread, getUnread: () => unread, refresh: poll };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
