import React, { useRef, useState } from 'react';
import { listSaves, saveTo, loadFrom, deleteSlot, exportSave, importSaveFile, timeAgo, SLOT_LABELS } from '../save.js';

/**
 * 存档面板（抽屉）：
 * - 3 个手动槽位 + 1 个自动存档
 * - 保存 / 读取 / 删除
 * - 导出为 JSON 文件、从文件导入
 */
export default function SavePanel({ state, onLoad, online }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => listSaves());
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);   // { action: 'load'|'delete', slot }
  const fileRef = useRef(null);

  const refresh = () => setItems(listSaves());

  const doSave = (slot) => {
    if (online) { setMsg({ type: 'err', text: '联机模式不能存档，请用单机模式' }); return; }
    const r = saveTo(slot, state);
    if (r.ok) { refresh(); setMsg({ type: 'ok', text: `已保存到「${SLOT_LABELS[slot]}」` }); }
    else setMsg({ type: 'err', text: r.message });
  };

  const doLoad = (slot) => {
    const s = loadFrom(slot);
    setPending(null);
    if (!s) { setMsg({ type: 'err', text: '存档不存在或已损坏' }); return; }
    onLoad(s.state);
    setOpen(false);
  };

  const doDelete = (slot) => {
    setPending(null);
    deleteSlot(slot);
    refresh();
    setMsg({ type: 'ok', text: '已删除' });
  };

  const doImport = async (file) => {
    if (!file) return;
    const r = await importSaveFile(file);
    if (!r.ok) { setMsg({ type: 'err', text: r.message }); return; }
    onLoad(r.save.state);
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="save-fab" onClick={() => { setOpen(true); refresh(); }} title="存档">
        💾 存档
      </button>
    );
  }

  return (
    <div className="save-drawer">
      <header className="save-head">
        <h3>💾 存档</h3>
        <button className="save-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
      </header>

      {online && <div className="errors">联机模式不支持存档</div>}
      {msg && <div className={msg.type === 'ok' ? 'ok-line' : 'errors'}>{msg.text}</div>}

      <div className="save-list">
        {items.map((it) => (
          <div key={it.slot} className={`save-item ${it.slot === 'auto' ? 'auto' : ''}`}>
            <div className="save-item-head">
              <b>{it.label}</b>
              {it.savedAt && <span className="muted small">{timeAgo(it.savedAt)}</span>}
            </div>

            {it.meta ? (
              <div className="save-meta muted small">
                {it.meta.title} · 第 {it.meta.week}/{it.meta.totalWeeks} 周 · {it.meta.students} 人 · 平均 {it.meta.avgGrade} · ¥{Number(it.meta.budget).toLocaleString()}
                {it.meta.finished && ' · 已毕业'}
              </div>
            ) : (
              <div className="save-meta muted small">空存档位</div>
            )}

            <div className="save-actions">
              {pending && pending.slot === it.slot ? (
                <>
                  <span className="muted small">
                    {pending.action === 'load' ? '读取会覆盖当前进度，确定？' : '确定删除这个存档？'}
                  </span>
                  <button
                    className="btn-small"
                    onClick={() => (pending.action === 'load' ? doLoad(it.slot) : doDelete(it.slot))}
                  >
                    确定
                  </button>
                  <button className="btn-small" onClick={() => setPending(null)}>取消</button>
                </>
              ) : (
                <>
                  {it.slot !== 'auto' && (
                    <button className="btn-small" onClick={() => doSave(it.slot)} disabled={online}>保存</button>
                  )}
                  <button className="btn-small" onClick={() => setPending({ action: 'load', slot: it.slot })} disabled={!it.meta}>读取</button>
                  {it.slot !== 'auto' && (
                    <button className="btn-small" onClick={() => setPending({ action: 'delete', slot: it.slot })} disabled={!it.meta}>删除</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="save-io">
        <button className="btn-small" onClick={() => exportSave(state)} disabled={online}>导出文件</button>
        <button className="btn-small" onClick={() => fileRef.current?.click()} disabled={online}>导入文件</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      <p className="muted small">
        存档保存在浏览器本地（localStorage）。换浏览器或清理数据会丢失，重要进度请导出文件备份。
      </p>
    </div>
  );
}
