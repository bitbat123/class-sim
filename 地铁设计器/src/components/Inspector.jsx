import React, { useState } from 'react';
import { PALETTE, LINE_PATTERNS, LABEL_POSITIONS, STATION_SHAPES, CANVAS_PRESETS } from '../model.js';
import { CITIES } from '../cities.js';

/** 右侧属性面板：线路 / 站点 / 文字 / 画布 / 背景 */
export default function Inspector({
  doc, activeLine, selectedStation, selectedText,
  onUpdateLine, onUpdateStation, onUpdateText, onUpdateCanvas, onUpdateBackground,
  onDeleteStation, onDeleteLine, onAddLine, onSetActiveLine,
  onRemoveStationFromLine, onMoveStationInLine, onAddText, onDeleteText,
  onDuplicateLine, onReverseLine, onSortLine, city, setCity, bgStatus, onReloadBg,
}) {
  const [tab, setTab] = useState('line');

  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        <button className={tab === 'line' ? 'on' : ''} onClick={() => setTab('line')}>线路</button>
        <button className={tab === 'station' ? 'on' : ''} onClick={() => setTab('station')}>站点</button>
        <button className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>文字</button>
        <button className={tab === 'canvas' ? 'on' : ''} onClick={() => setTab('canvas')}>画布</button>
      </div>

      {tab === 'line' && (
        <LinePanel
          doc={doc} activeLine={activeLine}
          onUpdateLine={onUpdateLine} onDeleteLine={onDeleteLine} onAddLine={onAddLine}
          onSetActiveLine={onSetActiveLine} onRemoveStationFromLine={onRemoveStationFromLine}
          onMoveStationInLine={onMoveStationInLine}
          onDuplicateLine={onDuplicateLine} onReverseLine={onReverseLine} onSortLine={onSortLine}
        />
      )}

      {tab === 'station' && (
        <StationPanel
          station={selectedStation} doc={doc}
          onUpdateStation={onUpdateStation} onDeleteStation={onDeleteStation}
          onRemoveStationFromLine={onRemoveStationFromLine} activeLine={activeLine}
        />
      )}

      {tab === 'text' && (
        <TextPanel
          doc={doc} selectedText={selectedText}
          onUpdateText={onUpdateText} onDeleteText={onDeleteText} onAddText={onAddText}
        />
      )}

      {tab === 'canvas' && (
        <CanvasPanel
          doc={doc} onUpdateCanvas={onUpdateCanvas} onUpdateBackground={onUpdateBackground}
          city={city} setCity={setCity} bgStatus={bgStatus} onReloadBg={onReloadBg}
        />
      )}
    </aside>
  );
}

function LinePanel({ doc, activeLine, onUpdateLine, onDeleteLine, onAddLine, onSetActiveLine, onRemoveStationFromLine, onMoveStationInLine, onDuplicateLine, onReverseLine, onSortLine }) {
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
        <input type="color" value={activeLine.color} onChange={(e) => set('color', e.target.value)} className="color-input" aria-label="自定义颜色" />
      </div>

      <label>线条花纹</label>
      <select value={activeLine.pattern} onChange={(e) => set('pattern', e.target.value)}>
        {LINE_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <label>线宽：{activeLine.width}px</label>
      <input type="range" min={3} max={24} value={activeLine.width} onChange={(e) => set('width', Number(e.target.value))} />

      <label>平滑度：{Math.round((activeLine.curve || 0) * 100)}%</label>
      <input type="range" min={0} max={1} step={0.05} value={activeLine.curve || 0} onChange={(e) => set('curve', Number(e.target.value))} />

      <label>不透明度：{Math.round((activeLine.opacity ?? 1) * 100)}%</label>
      <input type="range" min={0.2} max={1} step={0.05} value={activeLine.opacity ?? 1} onChange={(e) => set('opacity', Number(e.target.value))} />

      <label className="check-row">
        <input type="checkbox" checked={activeLine.loop} onChange={(e) => set('loop', e.target.checked)} />
        环线（首尾相连）
      </label>
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

      <div className="panel-actions">
        <button className="btn-small" onClick={() => onReverseLine(activeLine.id)}>反转顺序</button>
        <button className="btn-small" onClick={() => onSortLine(activeLine.id)}>按坐标排序</button>
      </div>

      <div className="panel-sep" />

      <div className="line-list">
        {doc.lines.map((l) => (
          <button key={l.id} className={`line-chip ${l.id === activeLine.id ? 'on' : ''}`} onClick={() => onSetActiveLine(l.id)}>
            <span className="line-dot" style={{ background: l.color }} />
            {l.name}
          </button>
        ))}
      </div>

      <div className="panel-actions">
        <button className="btn-small" onClick={onAddLine}>＋ 新增线路</button>
        <button className="btn-small" onClick={() => onDuplicateLine(activeLine.id)}>复制线路</button>
      </div>
      <button className="btn-small danger" onClick={() => onDeleteLine(activeLine.id)} disabled={doc.lines.length <= 1}>
        删除线路
      </button>
    </div>
  );
}

function StationPanel({ station, doc, onUpdateStation, onDeleteStation, onRemoveStationFromLine, activeLine }) {
  if (!station) return <p className="muted small">在画布上点一个站点来编辑它。</p>;
  const set = (k, v) => onUpdateStation(station.id, { [k]: v });
  const inActiveLine = activeLine?.stationIds.includes(station.id);
  const usedBy = doc.lines.filter((l) => l.stationIds.includes(station.id));

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

      <label>形状</label>
      <div className="pos-grid">
        {STATION_SHAPES.map((s) => (
          <button key={s.id} className={`pos-btn ${station.shape === s.id ? 'on' : ''}`} onClick={() => set('shape', s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      <label>站名位置</label>
      <div className="pos-grid">
        {LABEL_POSITIONS.map((p) => (
          <button key={p.id} className={`pos-btn ${station.labelPos === p.id ? 'on' : ''}`} onClick={() => set('labelPos', p.id)}>
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

      <div className="row-2">
        <div>
          <label>字号：{station.fontSize}</label>
          <input type="range" min={8} max={32} value={station.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))} />
        </div>
        <div>
          <label>旋转：{station.rotate}°</label>
          <input type="range" min={-90} max={90} step={5} value={station.rotate} onChange={(e) => set('rotate', Number(e.target.value))} />
        </div>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={station.open} onChange={(e) => set('open', e.target.checked)} />
        已启用（取消勾选显示为灰色）
      </label>

      <div className="panel-sep" />
      <p className="muted small">
        这个站被 {usedBy.length} 条线路使用{usedBy.length > 1 ? '（换乘站）' : ''}：
        {usedBy.map((l) => l.name).join('、') || '无'}
      </p>

      {activeLine && !inActiveLine && (
        <button className="btn-small" onClick={() => onUpdateStation(station.id, { __addToLine: activeLine.id })}>
          加入「{activeLine.name}」末尾
        </button>
      )}
      {activeLine && inActiveLine && (
        <button className="btn-small" onClick={() => onRemoveStationFromLine(activeLine.id, station.id)}>
          从「{activeLine.name}」移出
        </button>
      )}

      <button className="btn-small danger" onClick={() => onDeleteStation(station.id)}>删除这个站点</button>
    </div>
  );
}

function TextPanel({ doc, selectedText, onUpdateText, onDeleteText, onAddText }) {
  const t = doc.texts.find((x) => x.id === selectedText);

  return (
    <div className="panel-body">
      <button className="btn-small" onClick={onAddText}>＋ 添加文字标注</button>

      {!t && <p className="muted small">点画布上的文字来编辑，或先添加一个。</p>}

      {t && (
        <>
          <div className="panel-sep" />
          <label>内容</label>
          <textarea
            rows={3}
            value={t.text}
            onChange={(e) => onUpdateText(t.id, { text: e.target.value })}
          />

          <div className="row-2">
            <div>
              <label>X</label>
              <input type="number" value={Math.round(t.x)} onChange={(e) => onUpdateText(t.id, { x: Number(e.target.value) })} />
            </div>
            <div>
              <label>Y</label>
              <input type="number" value={Math.round(t.y)} onChange={(e) => onUpdateText(t.id, { y: Number(e.target.value) })} />
            </div>
          </div>

          <label>字号：{t.size}</label>
          <input type="range" min={10} max={64} value={t.size} onChange={(e) => onUpdateText(t.id, { size: Number(e.target.value) })} />

          <label>旋转：{t.rotate}°</label>
          <input type="range" min={-180} max={180} step={5} value={t.rotate} onChange={(e) => onUpdateText(t.id, { rotate: Number(e.target.value) })} />

          <label>颜色</label>
          <div className="swatches">
            {['#0f172a', '#ffffff', '#e4002b', '#0072ce', '#00a651', '#f5a623', '#8b5cf6', '#64748b'].map((c) => (
              <button key={c} className={`swatch ${t.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onUpdateText(t.id, { color: c })} aria-label={c} />
            ))}
            <input type="color" value={t.color} onChange={(e) => onUpdateText(t.id, { color: e.target.value })} className="color-input" aria-label="自定义文字颜色" />
          </div>

          <label>对齐</label>
          <div className="pos-grid">
            {[['left', '左'], ['center', '中'], ['right', '右']].map(([v, n]) => (
              <button key={v} className={`pos-btn ${t.align === v ? 'on' : ''}`} onClick={() => onUpdateText(t.id, { align: v })}>{n}</button>
            ))}
          </div>

          <button className="btn-small danger" onClick={() => onDeleteText(t.id)}>删除这段文字</button>
        </>
      )}
    </div>
  );
}

function CanvasPanel({ doc, onUpdateCanvas, onUpdateBackground, city, setCity, bgStatus, onReloadBg }) {
  const set = (k, v) => onUpdateCanvas({ [k]: v });
  const setBg = (k, v) => onUpdateBackground({ [k]: v });
  const bg = doc.canvas.background;

  return (
    <div className="panel-body">
      <label>画布尺寸</label>
      <div className="pos-grid">
        {CANVAS_PRESETS.map((p) => (
          <button
            key={p.name}
            className={`pos-btn ${doc.canvas.width === p.w && doc.canvas.height === p.h ? 'on' : ''}`}
            onClick={() => onUpdateCanvas({ width: p.w, height: p.h })}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="row-2">
        <div>
          <label>宽</label>
          <input type="number" min={600} max={12000} step={100} value={doc.canvas.width} onChange={(e) => set('width', Number(e.target.value))} />
        </div>
        <div>
          <label>高</label>
          <input type="number" min={600} max={12000} step={100} value={doc.canvas.height} onChange={(e) => set('height', Number(e.target.value))} />
        </div>
      </div>

      <label>网格间距：{doc.canvas.gridSize}</label>
      <input type="range" min={20} max={200} step={10} value={doc.canvas.gridSize} onChange={(e) => set('gridSize', Number(e.target.value))} />

      <label>默认缩放：{doc.canvas.initialZoom > 0 ? `${Math.round(doc.canvas.initialZoom * 100)}%` : '自动适应窗口'}</label>
      <input
        type="range" min={0} max={1} step={0.01}
        value={doc.canvas.initialZoom || 0}
        onChange={(e) => set('initialZoom', Number(e.target.value))}
      />

      <label>拖动吸附：{doc.canvas.snap ? doc.canvas.snap + 'px' : '关闭'}</label>
      <input type="range" min={0} max={50} step={5} value={doc.canvas.snap} onChange={(e) => set('snap', Number(e.target.value))} />

      <label className="check-row">
        <input type="checkbox" checked={doc.canvas.showGrid} onChange={(e) => set('showGrid', e.target.checked)} />
        显示网格
      </label>

      <div className="panel-sep" />
      <label>背景类型</label>
      <div className="pos-grid">
        {[['white', '白纸'], ['tiles', '街道'], ['city', '区县'], ['china', '全国']].map(([v, n]) => (
          <button key={v} className={`pos-btn ${bg.type === v ? 'on' : ''}`} onClick={() => setBg('type', v)}>{n}</button>
        ))}
      </div>

      {bg.type === 'tiles' && (
        <>
          <label>放大地图：{(Number.isFinite(Number(bg.mapZoom)) ? Number(bg.mapZoom) : 15).toFixed(1)}</label>
          <input
            type="range" min={10} max={18} step={0.1}
            value={Number.isFinite(Number(bg.mapZoom)) ? Number(bg.mapZoom) : 15}
            onChange={(e) => setBg('mapZoom', Number(e.target.value))}
          />

          <label>额外放大：{Math.round((bg.tileScale || 1) * 100)}%</label>
          <input type="range" min={0.5} max={4} step={0.1} value={bg.tileScale || 1} onChange={(e) => setBg('tileScale', Number(e.target.value))} />

          <label>瓦片不透明度：{Math.round((bg.tileOpacity ?? 1) * 100)}%</label>
          <input type="range" min={0.1} max={1} step={0.05} value={bg.tileOpacity ?? 1} onChange={(e) => setBg('tileOpacity', Number(e.target.value))} />

          <div className="row-2">
            <div>
              <label>中心经度</label>
              <input type="number" step="0.001" value={bg.centerLon} onChange={(e) => setBg('centerLon', Number(e.target.value))} />
            </div>
            <div>
              <label>中心纬度</label>
              <input type="number" step="0.001" value={bg.centerLat} onChange={(e) => setBg('centerLat', Number(e.target.value))} />
            </div>
          </div>
        </>
      )}

      {bg.type === 'city' && (
        <>
          <label>城市</label>
          <select
            value={city}
            onChange={(e) => { setCity(e.target.value); setBg('cityCode', e.target.value); }}
          >
            {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </>
      )}

      {(bg.type === 'city' || bg.type === 'china') && (
        <>
          <label>背景不透明度：{Math.round((bg.opacity ?? 1) * 100)}%</label>
          <input type="range" min={0.05} max={1} step={0.05} value={bg.opacity ?? 1} onChange={(e) => setBg('opacity', Number(e.target.value))} />

          <label>背景适配</label>
          <div className="pos-grid">
            {[['cover', '铺满'], ['contain', '全览'], ['manual', '手动']].map(([v, n]) => (
              <button key={v} className={pos-btn } onClick={() => setBg('fit', v)}>{n}</button>
            ))}
          </div>

          {(bg.fit || 'cover') === 'manual' && (
            <>
              <label>背景缩放：{Math.round((bg.scale ?? 1) * 100)}%</label>
              <input type="range" min={0.2} max={5} step={0.05} value={bg.scale ?? 1} onChange={(e) => setBg('scale', Number(e.target.value))} />

              <div className="row-2">
                <div>
                  <label>平移 X</label>
                  <input type="number" value={bg.offsetX ?? 0} onChange={(e) => setBg('offsetX', Number(e.target.value))} />
                </div>
                <div>
                  <label>平移 Y</label>
                  <input type="number" value={bg.offsetY ?? 0} onChange={(e) => setBg('offsetY', Number(e.target.value))} />
                </div>
              </div>
            </>
          )}

          <label className="check-row">
            <input type="checkbox" checked={bg.showNames} onChange={(e) => setBg('showNames', e.target.checked)} />
            显示区县 / 省名
          </label>

          {bgStatus.status === 'loading' && <p className="muted small">地图加载中…</p>}
          {bgStatus.status === 'error' && (
            <>
              <p className="err-line small">{bgStatus.error}</p>
              <button className="btn-small" onClick={onReloadBg}>重试</button>
            </>
          )}
          {bgStatus.status === 'ready' && bgStatus.detail && (
            <p className="muted small">{bgStatus.detail}</p>
          )}
        </>
      )}
    </div>
  );
}
