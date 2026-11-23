import React, { useState } from 'react';
import { PALETTE, LINE_PATTERNS, LABEL_POSITIONS } from '../model.js';

/** 右侧属性面板：线路设置 + 站点设置 + 画布设置 */
export default function Inspector({
  doc, activeLine, selectedStation, onUpdateLine, onUpdateStation, onUpdateCanvas,
  onDeleteStation, onDeleteLine, onAddLine, onSetActiveLine, onRemoveStationFromLine, onMoveStationInLine,
}) {
  const [tab, setTab] = useState('line');

  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        <button className={tab === 'line' ? 'on' : ''} onClick={() => setTab('line')}>线路</button>
        <button className={tab === 'station' ? 'on' : ''} onClick={() => setTab('station')}>站点</button>
        <button className={tab === 'canvas' ? 'on' : ''} onClick={() => setTab('canvas')}>画布</button>
      </div>

      {tab === 'line' && (
        <LinePanel
          doc={doc}
          activeLine={activeLine}
          onUpdateLine={onUpdateLine}
          onDeleteLine={onDeleteLine}
          onAddLine={onAddLine}
          onSetActiveLine={onSetActiveLine}
          onRemoveStationFromLine={onRemoveStationFromLine}
          onMoveStationInLine={onMoveStationInLine}
        />
      )}

      {tab === 'station' && (
        <StationPanel
          station={selectedStation}
          onUpdateStation={onUpdateStation}
          onDeleteStation={onDeleteStation}
        />
      )}

      {tab === 'canvas' && (
        <CanvasPanel doc={doc} onUpdateCanvas={onUpdateCanvas} />
      )}
    </aside>
  );
}

function LinePanel({ doc, activeLine, onUpdateLine, onDeleteLine, onAddLine, onSetActiveLine, onRemoveStationFromLine, onMoveStationInLine }) {
  if (!activeLine) return <p className="muted small">还没有线路，点「＋ 新增线路」开始。</p>;
  const set = (k, v) => onUpdateLine(activeLine.id, { [k]: v });

  return (
    <div className="panel-body">
      <label>线路名称</label>
      <input value={activeLine.name} onChange={(e) => set('name', e.target.value)} />

      <label>颜色</label>
      <div className="swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`swatch ${activeLine.color === c ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => set('color', c)}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          value={activeLine.color}
          onChange={(e) => set('color', e.target.value)}
          className="color-input"
          aria-label="自定义颜色"
        />
      </div>

      <label>线条花纹</label>
      <select value={activeLine.pattern} onChange={(e) => set('pattern', e.target.value)}>
        {LINE_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <label>线宽：{activeLine.width}px</label>
      <input
        type="range"
        min={3}
        max={22}
        value={activeLine.width}
        onChange={(e) => set('width', Number(e.target.value))}
      />

      <label className="check-row">
        <input type="checkbox" checked={activeLine.visible} onChange={(e) => set('visible', e.target.checked)} />
        显示这条线
      </label>

      <div className="panel-sep" />

      <label>本站序号（共 {activeLine.stationIds.length} 站）</label>
      <ol className="station-order">
        {activeLine.stationIds.map((id, i) => {
          const st = doc.stations.find((s) => s.id === id);
          return (
            <li key={id}>
              <span className="order-name">{st ? st.name : '(已删除)'}</span>
              <span className="order-actions">
                <button onClick={() => onMoveStationInLine(activeLine.id, i, -1)} disabled={i === 0} aria-label="上移">↑</button>
                <button onClick={() => onMoveStationInLine(activeLine.id, i, 1)} disabled={i === activeLine.stationIds.length - 1} aria-label="下移">↓</button>
                <button onClick={() => onRemoveStationFromLine(activeLine.id, id)} aria-label="移出线路">×</button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="panel-sep" />

      <div className="line-list">
        {doc.lines.map((l) => (
          <button
            key={l.id}
            className={`line-chip ${l.id === activeLine.id ? 'on' : ''}`}
            onClick={() => onSetActiveLine(l.id)}
          >
            <span className="line-dot" style={{ background: l.color }} />
            {l.name}
          </button>
        ))}
      </div>

      <div className="panel-actions">
        <button className="btn-small" onClick={onAddLine}>＋ 新增线路</button>
        <button className="btn-small danger" onClick={() => onDeleteLine(activeLine.id)} disabled={doc.lines.length <= 1}>
          删除线路
        </button>
      </div>
    </div>
  );
}

function StationPanel({ station, onUpdateStation, onDeleteStation }) {
  if (!station) return <p className="muted small">在画布上点一个站点来编辑它。</p>;
  const set = (k, v) => onUpdateStation(station.id, { [k]: v });

  return (
    <div className="panel-body">
      <label>站名</label>
      <input value={station.name} onChange={(e) => set('name', e.target.value)} />

      <div className="row-2">
        <div>
          <label>X</label>
          <input type="number" value={Math.round(station.x)} onChange={(e) => set('x', Number(e.target.value))} />
        </div>
        <div>
          <label>Y</label>
          <input type="number" value={Math.round(station.y)} onChange={(e) => set('y', Number(e.target.value))} />
        </div>
      </div>

      <label>站名位置</label>
      <div className="pos-grid">
        {LABEL_POSITIONS.map((p) => (
          <button
            key={p.id}
            className={`pos-btn ${station.labelPos === p.id ? 'on' : ''}`}
            onClick={() => set('labelPos', p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {station.labelPos === 'custom' && (
        <div className="row-2">
          <div>
            <label>偏移 X</label>
            <input type="number" value={station.labelDx} onChange={(e) => set('labelDx', Number(e.target.value))} />
          </div>
          <div>
            <label>偏移 Y</label>
            <input type="number" value={station.labelDy} onChange={(e) => set('labelDy', Number(e.target.value))} />
          </div>
        </div>
      )}

      <label className="check-row">
        <input type="checkbox" checked={station.open} onChange={(e) => set('open', e.target.checked)} />
        已启用（取消勾选显示为灰色）
      </label>

      <div className="panel-sep" />
      <button className="btn-small danger" onClick={() => onDeleteStation(station.id)}>删除这个站点</button>
    </div>
  );
}

function CanvasPanel({ doc, onUpdateCanvas }) {
  const set = (k, v) => onUpdateCanvas({ [k]: v });
  return (
    <div className="panel-body">
      <label>画布宽度</label>
      <input type="number" min={600} max={6000} step={100} value={doc.canvas.width} onChange={(e) => set('width', Number(e.target.value))} />

      <label>画布高度</label>
      <input type="number" min={600} max={6000} step={100} value={doc.canvas.height} onChange={(e) => set('height', Number(e.target.value))} />

      <label className="check-row">
        <input type="checkbox" checked={doc.canvas.showGrid} onChange={(e) => set('showGrid', e.target.checked)} />
        显示网格
      </label>

      <div className="panel-sep" />
      <p className="muted small">背景在左侧「背景」区切换（白纸 / 中国城市 / 中国全图）。</p>
    </div>
  );
}
