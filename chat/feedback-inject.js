// 全站反馈按钮：注入到主页和所有游戏页（与聊天室按钮并列）
// 登录后才能提交；点击在新标签打开主页的反馈入口。
(function () {
  'use strict';

  const ENV_ID = 'interim-toucan-d4g2tnti4470549e1';
  const PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImJiZDBjZTU4LWUwNmUtNDRhZC04N2I2LWZlYWU2MjkzZmUwOSJ9.eyJpc3MiOiJodHRwczovL2ludGVyaW0tdG91Y2FuLWQ0ZzJ0bnRpNDQ3MDU0OWUxLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJpbnRlcmltLXRvdWNhbi1kNGcydG50aTQ0NzA1NDllMSIsImV4cCI6NDA5ODA3NTU5MiwiaWF0IjoxNzk0MzkyMzkyLCJub25jZSI6ImJKY04zLVN6UVFLTHdGSDNYN3NGQVEiLCJhdF9oYXNoIjoiYkpjTjMtU3pRUUtMd0ZIM1g3c0ZBUSIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJpbnRlcmltLXRvdWNhbi1kNGcydG50aTQ0NzA1NDllMSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.TTEpUSgY-NO9zDk0yADRFc1BXgTvXR9KbmIhXLAJ-PvQrgvGQMF9IpdYc-flXJRL6VqUKgrpKQO8flZyd5sDJwA5x1h_Hz94mJCr2NwxYzzXKdmmlA4H90JtSkikanfY63pdjRgoDvWGICby4z4d6bMlEurxq8axk1T7MpelcqTYcOhEWPkmT2vV-s77GGihHw16eePpg0w2ip7d8__r3lyXTEQ7AXJ4_M5aMGF6on1_zjnYXip8MUgX1Dc9GXJYooNtSUp6eJtUivCT4zgAZgEkrLAiqrNJG1UapkBeeRL7T3uLivu6rbO9ySGSzm2kAmRETEX8Q0zWHrw3hjbjtg';
  const HOME_URL = '/';
  const FAB_ID = 'dsh-feedback-btn';
  const PANEL_ID = 'dsh-feedback-panel';

  let app = null;
  let username = null;
  let open = false;

  function ensureStyle() {
    if (document.getElementById('dsh-feedback-style')) return;
    const st = document.createElement('style');
    st.id = 'dsh-feedback-style';
    st.textContent = `
      #dsh-feedback-btn {
        position: fixed; left: 18px; bottom: 18px; z-index: 2147483000;
        display: flex; align-items: center; gap: 7px;
        padding: 10px 15px; border-radius: 999px; border: none; cursor: pointer;
        background: linear-gradient(135deg, #f59e0b, #ec4899); color: #fff;
        font: 600 14px/1 'Segoe UI','Microsoft YaHei',system-ui,sans-serif;
        box-shadow: 0 6px 20px rgba(245,158,11,.45); transition: transform .15s ease;
      }
      #dsh-feedback-btn:hover { transform: translateY(-2px); }
      #dsh-feedback-panel {
        position: fixed; left: 18px; bottom: 18px; z-index: 2147483001;
        width: min(380px, calc(100vw - 36px)); max-height: min(560px, calc(100vh - 36px));
        background: #0f172a; color: #e2e8f0; border: 1px solid rgba(148,163,184,.25);
        border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
        box-shadow: 0 12px 40px rgba(0,0,0,.6);
        font: 13px/1.5 'Segoe UI','Microsoft YaHei',system-ui,sans-serif;
      }
      #dsh-feedback-panel h3 { margin: 0; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }
      #dsh-feedback-panel textarea, #dsh-feedback-panel input {
        width: 100%; background: rgba(15,23,42,.85); border: 1px solid rgba(148,163,184,.25);
        border-radius: 9px; padding: 9px; color: #e2e8f0; font: inherit; resize: vertical;
      }
      #dsh-feedback-panel .fb-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      #dsh-feedback-panel button.fb-submit {
        background: linear-gradient(135deg,#f59e0b,#ec4899); border: none; color: #fff;
        border-radius: 9px; padding: 8px 16px; font: inherit; font-weight: 600; cursor: pointer;
      }
      #dsh-feedback-panel button.fb-close { background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1; }
      #dsh-feedback-panel .fb-msg { font-size: 12px; color: #86efac; }
      #dsh-feedback-panel .fb-msg.err { color: #fca5a5; }
      #dsh-feedback-panel .fb-hint { font-size: 11px; color: #94a3b8; }
    `;
    document.head.appendChild(st);
  }

  function ensureButton() {
    let el = document.getElementById(FAB_ID);
    if (!el) {
      el = document.createElement('button');
      el.id = FAB_ID;
      el.type = 'button';
      el.innerHTML = '<span>📮</span><span>反馈</span>';
      el.title = '反馈与建议';
      el.addEventListener('click', () => { open ? closePanel() : showPanel(); });
      document.body.appendChild(el);
    }
    return el;
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

  function closePanel() {
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    open = false;
  }

  function showPanel() {
    ensureStyle();
    if (document.getElementById(PANEL_ID)) { closePanel(); return; }
    open = true;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h3>📮 反馈与建议 <button class="fb-close" aria-label="关闭">×</button></h3>
      <div class="fb-hint">来自：${document.title || location.hostname}</div>
      <textarea rows="6" maxlength="2000" placeholder="遇到什么问题？想要什么功能？"></textarea>
      <input maxlength="100" placeholder="联系方式（可选）" />
      <div class="fb-row"><span class="fb-hint">0 / 2000</span><button class="fb-submit">提交反馈</button></div>
      <div class="fb-msg" hidden></div>
    `;
    document.body.appendChild(panel);

    const ta = panel.querySelector('textarea');
    const contact = panel.querySelector('input');
    const counter = panel.querySelector('.fb-hint:nth-of-type(2)');
    const msgEl = panel.querySelector('.fb-msg');
    const submit = panel.querySelector('.fb-submit');

    panel.querySelector('.fb-close').addEventListener('click', closePanel);
    ta.addEventListener('input', () => {
      const c = panel.querySelectorAll('.fb-hint');
      c[c.length - 1].textContent = `${ta.value.length} / 2000`;
    });

    submit.addEventListener('click', async () => {
      const body = ta.value.trim();
      if (!body) return;
      const token = localStorage.getItem('authToken');
      if (!token) {
        msgEl.hidden = false;
        msgEl.className = 'fb-msg err';
        msgEl.textContent = '请先在主页登录后再提交反馈';
        return;
      }
      submit.disabled = true;
      submit.textContent = '提交中…';
      try {
        const r = await callAuth('feedbackAdd', {
          game: gameId(),
          body,
          contact: contact.value.trim(),
        });
        msgEl.hidden = false;
        if (r && r.ok) {
          msgEl.className = 'fb-msg';
          msgEl.textContent = '✅ 感谢反馈！已收到。';
          ta.value = '';
          contact.value = '';
        } else {
          msgEl.className = 'fb-msg err';
          msgEl.textContent = (r && r.message) || '提交失败';
        }
      } catch (e) {
        msgEl.hidden = false;
        msgEl.className = 'fb-msg err';
        msgEl.textContent = '网络错误：' + e.message;
      } finally {
        submit.disabled = false;
        submit.textContent = '提交反馈';
      }
    });
  }

  /** 根据当前 URL 推断游戏标识 */
  function gameId() {
    const p = location.pathname;
    if (p.includes('/bomb-contest/')) return 'bomb';
    if (p.includes('/gomoku/')) return 'gomoku';
    if (p.includes('/racing/')) return 'racing';
    if (p.includes('/chat/')) return 'chat';
    if (p === '/class-sim/' || p.endsWith('/class-sim')) return 'class-teacher';
    return 'home';
  }

  async function init() {
    ensureStyle();
    const btn = ensureButton();
    const token = localStorage.getItem('authToken');
    if (!token) { btn.style.display = 'none'; return; }
    try {
      const r = await callAuth('session', { token });
      if (!r || !r.ok) { btn.style.display = 'none'; return; }
      username = r.username;
      btn.style.display = 'flex';
    } catch {
      btn.style.display = 'none';
    }
  }

  window.DSHFeedback = { open: showPanel, close: closePanel };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
