import React, { useEffect, useMemo, useState } from 'react';
import { callAuth, getToken } from './cloud.js';

/**
 * 自制游戏平台（单页应用，三件事都在这里）：
 *   #/build   制作游戏（管理员）
 *   #/browse  浏览所有自制游戏（所有人）
 *   #/play/<slug>  全屏玩游戏（所有人）
 *
 * 游戏本体是一段 HTML，存在 social.custom_games.html。
 * 播放时用 iframe sandbox="allow-scripts allow-forms allow-modals allow-popups"
 * 隔离 —— 不给 allow-same-origin，所以游戏脚本拿不到本页的 token / localStorage。
 */

const TABS = [
  { id: 'build', name: '🛠 制作游戏', adminOnly: true },
  { id: 'browse', name: '🎮 游戏库', adminOnly: false },
];

const STARTER_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>我的小游戏</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:linear-gradient(135deg,#0f172a,#1e293b); color:#e2e8f0;
         font-family:'Segoe UI','Microsoft YaHei',system-ui,sans-serif; }
  .box { text-align:center; padding:24px; }
  h1 { font-size:28px; margin:0 0 8px; }
  button { font:inherit; font-size:16px; padding:10px 22px; border-radius:10px;
           border:none; background:#8b5cf6; color:#fff; cursor:pointer; margin-top:16px; }
  button:hover { background:#7c3aed; }
</style>
</head>
<body>
  <div class="box">
    <h1>🎮 我的小游戏</h1>
    <p>点几下试试。</p>
    <p>你点了 <b id="n">0</b> 次</p>
    <button id="btn">点我</button>
  </div>
  <script>
    let n = 0;
    document.getElementById('btn').addEventListener('click', () => {
      n++;
      document.getElementById('n').textContent = n;
    });
  </script>
</body>
</html>`;

/** 读取当前 hash 路由 */
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const [tab, ...rest] = h.split('/');
  return { tab: tab || '', rest };
}

export default function App() {
  const [route, setRoute] = useState(() => parseHash());
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  // 监听 hash 变化
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 登录状态 + 管理员身份
  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    callAuth('session', { token })
      .then(async (r) => {
        if (!r.ok) return;
        setMe(r.username);
        const w = await callAuth('adminWhoAmI', {});
        setIsAdmin(!!(w && w.ok && w.isAdmin));
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const go = (path) => { window.location.hash = `#/${path}`; };

  if (checking) {
    return <div className="cg-app"><p className="muted center">加载中…</p></div>;
  }

  // 播放模式：全屏，不要外壳
  if (route.tab === 'play' && route.rest.length) {
    return <PlayView slug={route.rest.join('/')} onBack={() => go('browse')} />;
  }

  const tab = route.tab === 'build' ? 'build' : 'browse';

  return (
    <div className="cg-app">
      <header className="cg-head">
        <div className="cg-brand">
          <span className="cg-logo">🧪</span>
          <div>
            <h1>自制游戏</h1>
            <p className="muted small">用一段 HTML 做出能玩的游戏</p>
          </div>
        </div>

        <nav className="cg-tabs">
          {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button
              key={t.id}
              className={`cg-tab ${tab === t.id ? 'on' : ''}`}
              onClick={() => go(t.id)}
            >
              {t.name}
            </button>
          ))}
        </nav>

        <div className="cg-user">
          {me ? <span className="muted small">{me}{isAdmin ? '（管理员）' : ''}</span> : <span className="muted small">未登录</span>}
          <a className="cg-home" href="/">← 主页</a>
        </div>
      </header>

      {tab === 'build' && (
        isAdmin
          ? <BuildView onPlay={(slug) => go(`play/${slug}`)} onBrowse={() => go('browse')} />
          : <NoPerm />
      )}

      {tab === 'browse' && (
        <BrowseView onPlay={(slug) => go(`play/${slug}`)} canBuild={isAdmin} onBuild={() => go('build')} />
      )}
    </div>
  );
}

function NoPerm() {
  return (
    <section className="cg-panel">
      <h2>🔒 只有管理员可以制作游戏</h2>
      <p className="muted">如果你觉得自己也能做，去找管理员要权限吧。</p>
    </section>
  );
}

/* ---------------- 制作 ---------------- */
function BuildView({ onPlay, onBrowse }) {
  const [list, setList] = useState([]);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎮');
  const [html, setHtml] = useState(STARTER_HTML);
  const [published, setPublished] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [confirmSlug, setConfirmSlug] = useState(null);

  const load = async () => {
    setLoadErr(null);
    const r = await callAuth('gameList', {});
    if (r.ok) setList(r.games || []);
    else setLoadErr(r.message);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setSlug(''); setTitle(''); setDescription(''); setIcon('🎮');
    setHtml(STARTER_HTML); setPublished(true); setPreview(false); setMsg(null);
  };

  /** 载入已有游戏来编辑 */
  const edit = async (g) => {
    const r = await callAuth('gameGet', { slug: g.slug });
    if (!r.ok) { setMsg({ type: 'err', text: r.message }); return; }
    setSlug(r.game.slug);
    setTitle(r.game.title);
    setDescription(r.game.description);
    setIcon(r.game.icon);
    setHtml(r.game.html);
    setPublished(r.game.published);
    setPreview(false);
    setMsg({ type: 'ok', text: `已载入「${r.game.title}」` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await callAuth('gameSave', { slug, title, description, html, icon, published });
      if (r.ok) {
        setMsg({ type: 'ok', text: `已保存「${r.game.title}」，地址 #/play/${r.game.slug}` });
        load();
      } else {
        setMsg({ type: 'err', text: r.message });
      }
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g) => {
    // 不用 window.confirm（部分浏览器/内嵌环境会屏蔽），改成二次点击确认
    if (confirmSlug !== g.slug) {
      setConfirmSlug(g.slug);
      setMsg({ type: 'err', text: `再点一次「删」确认删除「${g.title}」` });
      return;
    }
    setConfirmSlug(null);
    setBusy(true);
    try {
      const r = await callAuth('gameDelete', { slug: g.slug });
      if (r.ok) { setMsg({ type: 'ok', text: `已删除「${g.title}」` }); load(); }
      else setMsg({ type: 'err', text: r.message });
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const slugFromTitle = () => {
    // 中文标题没法直接转 slug，用时间戳兜底
    const t = title.trim();
    const ascii = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return ascii || `game-${Date.now().toString(36)}`;
  };

  const bytes = useMemo(() => new Blob([html]).size, [html]);

  return (
    <div className="cg-build">
      <section className="cg-panel">
        <h2>{slug ? '✏️ 编辑游戏' : '🛠 制作新游戏'}</h2>

        {msg && <div className={msg.type === 'ok' ? 'cg-ok' : 'cg-err'}>{msg.text}</div>}

        <div className="cg-row2">
          <div>
            <label>短名（URL 用，小写字母/数字/连字符）</label>
            <div className="cg-inline">
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="my-game" />
              <button className="cg-btn" onClick={() => setSlug(slugFromTitle())} type="button">自动</button>
            </div>
          </div>
          <div>
            <label>图标（一个 emoji）</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          </div>
        </div>

        <label>游戏名</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="我的第一个游戏" />

        <label>一句话介绍</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="点按钮就会加一" maxLength={200} />

        <label className="cg-check">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          发布到游戏库（取消勾选则只有管理员看得到）
        </label>

        <label>
          HTML 代码 <span className="muted small">（{html.length} 字符 · {(bytes / 1024).toFixed(1)} KB / 上限 500 KB）</span>
        </label>
        <textarea
          className="cg-code"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          rows={22}
        />

        <div className="cg-actions">
          <button className="cg-btn primary" onClick={save} disabled={busy || !slug || !title.trim() || !html.trim()}>
            {busy ? '保存中…' : '💾 保存'}
          </button>
          <button className="cg-btn" onClick={() => setPreview((v) => !v)} type="button">
            {preview ? '关闭预览' : '👁 预览'}
          </button>
          <button className="cg-btn" onClick={reset} type="button">清空表单</button>
          {slug && (
            <button className="cg-btn" onClick={() => onPlay(slug)} type="button">▶ 去玩</button>
          )}
        </div>

        {preview && (
          <div className="cg-preview">
            <iframe
              title="preview"
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              srcDoc={html}
            />
          </div>
        )}
      </section>

      <section className="cg-panel">
        <div className="cg-panel-head">
          <h2>我的游戏（{list.length}）</h2>
          <button className="cg-btn" onClick={load} type="button">刷新</button>
        </div>
        {loadErr && <div className="cg-err">{loadErr}</div>}
        {list.length === 0 && <p className="muted">还没有游戏，先做一个吧。</p>}
        <div className="cg-mini-list">
          {list.map((g) => (
            <div key={g.slug} className="cg-mini">
              <span className="cg-mini-icon">{g.icon}</span>
              <div className="cg-mini-body">
                <b>{g.title}</b>
                <span className="muted small">
                  #{g.slug} · {g.plays} 次游玩{g.published ? '' : ' · 未发布'}
                </span>
              </div>
              <div className="cg-mini-actions">
                <button className="cg-btn tiny" onClick={() => edit(g)} type="button">编辑</button>
                <button className="cg-btn tiny" onClick={() => onPlay(g.slug)} type="button">玩</button>
                <button className="cg-btn tiny danger" onClick={() => remove(g)} type="button">删</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- 游戏库 ---------------- */
function BrowseView({ onPlay, canBuild, onBuild }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callAuth('gameList', {})
      .then((r) => { if (r.ok) setList(r.games || []); else setErr(r.message); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="cg-panel">
      <div className="cg-panel-head">
        <h2>🎮 全部自制游戏（{list.length}）</h2>
        {canBuild && <button className="cg-btn primary" onClick={onBuild} type="button">＋ 做一个</button>}
      </div>

      {err && <div className="cg-err">{err}</div>}
      {loading && <p className="muted">加载中…</p>}
      {!loading && list.length === 0 && (
        <p className="muted">还没有人发布游戏。{canBuild ? '点上面的按钮做一个吧。' : ''}</p>
      )}

      <div className="cg-grid">
        {list.map((g) => (
          <button key={g.slug} className="cg-card" onClick={() => onPlay(g.slug)} type="button">
            <div className="cg-card-icon">{g.icon}</div>
            <div className="cg-card-body">
              <h3>{g.title}</h3>
              <p>{g.description || '（没有介绍）'}</p>
              <div className="cg-card-meta">
                <span className="muted small">by {g.author}</span>
                <span className="muted small">{g.plays} 次游玩</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 播放 ---------------- */
function PlayView({ slug, onBack }) {
  const [game, setGame] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callAuth('gameGet', { slug })
      .then((r) => { if (r.ok) setGame(r.game); else setErr(r.message); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="cg-play"><p className="muted center">加载游戏…</p></div>;
  if (err) {
    return (
      <div className="cg-play">
        <div className="cg-play-err">
          <h2>打不开这个游戏</h2>
          <p className="muted">{err}</p>
          <button className="cg-btn" onClick={onBack} type="button">← 回游戏库</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cg-play">
      <header className="cg-play-head">
        <button className="cg-btn" onClick={onBack} type="button">← 游戏库</button>
        <h2>{game.icon} {game.title}</h2>
        <span className="muted small">by {game.author} · {game.plays} 次游玩</span>
      </header>
      <iframe
        className="cg-stage"
        title={game.title}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        srcDoc={game.html}
      />
    </div>
  );
}
