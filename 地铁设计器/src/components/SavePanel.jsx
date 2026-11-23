import React, { useRef, useState } from 'react';
import { listSaves, saveDoc, loadDoc, deleteSlot, exportDoc, importFile, timeAgo, SLOT_LABELS } from '../model.js';

/** 存档面板：4 个槽位 + 导入导出 */
export default function SavePanel({ doc, onLoad }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => listSaves());
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null);
  const fileRef = useRef(null);

  const refresh = () => setItems(listSaves());

  const doSave = (slot) => {
    const r = saveDoc(slot, doc);
    if (r.ok) { refresh(); setMsg({ type: 'ok', text: `已保存到「${SLOT_LABELS[slot]}」` }); }
    else setMsg({ type: 'err', text: r.message });
  };

  const doLoad = (slot) => {
    setPending(null);
    const s = loadDoc(slot);
    if (!s) { setMsg({ type: 'err', text: '存档不存在或已损坏' }); return; }
    onLoad(s.doc);
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
    const r = await importFile(file);
    if (!r.ok) { setMsg({ type: 'err', text: r.message }); return; }
    onLoad(r.doc);
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="toolbar-btn save" onClick={() => { setOpen(true); refresh(); }}>
        💾 存档
      </button>
    );
  }

  return (
    <div className="save-pop">
      <header>
        <h3>💾 存档</h3>
        <button className="x" onClick={() => setOpen(false)} aria-label="关闭">×</button>
      </header>

      {msg && <div className={msg.type === 'ok' ? 'ok-line' : 'err-line'}>{msg.text}</div>}

      <div className="save-items">
        {items.map((it) => (
          <div key={it.slot} className={`save-row ${it.slot === 'auto' ? 'auto' : ''}`}>
            <div className="save-row-head">
              <b>{it.label}</b>
              {it.savedAt && <span className="muted small">{timeAgo(it.savedAt)}</span>}
            </div>
            {it.meta ? (
              <div className="muted small">{it.meta.name} · {it.meta.lines} 线 / {it.meta.stations} 站</div>
            ) : (
              <div className="muted small">空存档位</div>
            )}

            <div className="save-row-actions">
              {pending === it.slot ? (
                <>
                  <span className="muted small">确定读取？</span>
                  <button onClick={() => doLoad(it.slot)}>确定</button>
                  <button onClick={() => setPending(null)}>取消</button>
                </>
              ) : (
                <>
                  {it.slot !== 'auto' && <button onClick={() => doSave(it.slot)}>保存</button>}
                  <button onClick={() => setPending(it.slot)} disabled={!it.meta}>读取</button>
                  {it.slot !== 'auto' && (
                    <button onClick={() => doDelete(it.slot)} disabled={!it.meta}>删除</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="save-io">
        <button onClick={() => exportDoc(doc)}>导出文件</button>
        <button onClick={() => fileRef.current?.click()}>导入文件</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      <p className="muted small">存档保存在浏览器本地。换设备请用「导出文件」备份。</p>
    </div>
  );
}
