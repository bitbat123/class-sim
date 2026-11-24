import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MetroCanvas from './components/MetroCanvas.jsx';
import Inspector from './components/Inspector.jsx';
import SavePanel from './components/SavePanel.jsx';
import {
  createDoc, createDemoDoc, normalizeDoc, newStation, newLine, newText, saveDoc, loadDoc,
} from './model.js';
import { CITIES, CHINA_CODE } from './cities.js';
import { ZOOM_HINTS, zoomHintOf } from './tiles.js';
import { loadBackground, fitToCanvas } from './background.js';

/** 导出当前画布为 SVG 字符串（含背景） */
function buildSvgString(svgEl) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

export default function App() {
  const [doc, setDoc] = useState(() => {
    const last = loadDoc('auto');
    if (last) return last.doc;
    return createDemoDoc();
  });
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedText, setSelectedText] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [zoomInited, setZoomInited] = useState(false);
  const [bgState, setBgState] = useState({ status: 'idle', data: null, error: null });
  const [adding, setAdding] = useState(true);
  const [city, setCity] = useState('310000');
  const [bgNonce, setBgNonce] = useState(0);
  const autoSaveTimer = useRef(null);
  const canvasRef = useRef(null);

  const activeLine = useMemo(
    () => doc.lines.find((l) => l.id === doc.activeLineId) || doc.lines[0],
    [doc.lines, doc.activeLineId],
  );
  const station = useMemo(
    () => doc.stations.find((s) => s.id === selectedStation) || null,
    [doc.stations, selectedStation],
  );

  // ---- 自动存档（防抖 800ms） ----
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDoc('auto', doc), 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [doc]);

  // ---- 背景加载 ----
  const bgType = doc.canvas.background.type;
  const bgCode = doc.canvas.background.cityCode || city;
  useEffect(() => {
    if (bgType === 'white' || bgType === 'tiles') { setBgState({ status: 'ready', data: null, error: null }); return; }
    const code = bgType === 'china' ? CHINA_CODE : bgCode;
    let alive = true;
    setBgState({ status: 'loading', data: null, error: null });
    loadBackground(code)
      .then((data) => {
        if (!alive) return;
        setBgState({
          status: 'ready',
          data,
          error: null,
          detail: `${data.paths.length} 个多边形 · ${data.names.length} 个区县/省名`,
        });
      })
      .catch((e) => { if (alive) setBgState({ status: 'error', data: null, error: e.message }); });
    return () => { alive = false; };
  }, [bgType, bgCode, bgNonce]);

  const background = useMemo(() => {
    if (!bgState.data) return null;
    const bg = doc.canvas.background;
    return fitToCanvas(bgState.data, doc.canvas.width, doc.canvas.height, {
      fit: bg.fit || 'contain',
      scale: bg.scale,
      offsetX: bg.offsetX,
      offsetY: bg.offsetY,
      padding: 16,
    });
  }, [bgState.data, doc.canvas.width, doc.canvas.height, doc.canvas.background]);

  // ---- 文档操作 ----
  const patch = useCallback((fn) => setDoc((d) => normalizeDoc(fn(structuredClone(d)))), []);

  const addStationAt = (x, y) => {
    const st = newStation(x, y, `新站${doc.stations.length + 1}`);
    setDoc((d) => {
      const next = structuredClone(d);
      next.stations.push(st);
      const line = next.lines.find((l) => l.id === next.activeLineId) || next.lines[0];
      if (line) {
        line.stationIds.push(st.id);
        next.activeLineId = line.id;
      }
      return next;
    });
    setSelectedStation(st.id);
    setSelectedText(null);
  };

  const onCanvasClick = (e) => {
    if (!adding) return;
    // 点在站点 / 文字上时，它们自己 stopPropagation 了，这里就是空白处
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    const snap = doc.canvas.snap || 0;
    const x = snap ? Math.round(local.x / snap) * snap : local.x;
    const y = snap ? Math.round(local.y / snap) * snap : local.y;
    addStationAt(Math.round(x), Math.round(y));
  };

  const updateLine = (id, changes) => {
    patch((d) => {
      d.lines = d.lines.map((l) => (l.id === id ? { ...l, ...changes } : l));
      return d;
    });
  };

  const updateStation = (id, changes) => {
    // 「加入线路」走特殊处理
    if (changes.__addToLine) {
      const lineId = changes.__addToLine;
      patch((d) => {
        const line = d.lines.find((l) => l.id === lineId);
        if (line && !line.stationIds.includes(id)) line.stationIds.push(id);
        return d;
      });
      return;
    }
    patch((d) => {
      d.stations = d.stations.map((s) => (s.id === id ? { ...s, ...changes } : s));
      return d;
    });
  };

  const updateText = (id, changes) => {
    patch((d) => {
      d.texts = d.texts.map((t) => (t.id === id ? { ...t, ...changes } : t));
      return d;
    });
  };

  const moveStation = (id, x, y) => {
    setDoc((d) => {
      const next = structuredClone(d);
      const s = next.stations.find((n) => n.id === id);
      if (s) { s.x = Math.round(x); s.y = Math.round(y); }
      return next;
    });
  };

  const moveText = (id, x, y) => {
    setDoc((d) => {
      const next = structuredClone(d);
      const t = next.texts.find((n) => n.id === id);
      if (t) { t.x = Math.round(x); t.y = Math.round(y); }
      return next;
    });
  };

  const deleteStation = (id) => {
    patch((d) => {
      d.stations = d.stations.filter((s) => s.id !== id);
      d.lines = d.lines.map((l) => ({ ...l, stationIds: l.stationIds.filter((sid) => sid !== id) }));
      return d;
    });
    setSelectedStation(null);
  };

  const addLine = () => {
    patch((d) => {
      const l = newLine(d.lines.length);
      l.name = `${d.lines.length + 1} 号线`;
      d.lines.push(l);
      d.activeLineId = l.id;
      return d;
    });
  };

  const duplicateLine = (id) => {
    patch((d) => {
      const src = d.lines.find((l) => l.id === id);
      if (!src) return d;
      const copy = {
        ...structuredClone(src),
        id: newLine(0).id,
        name: `${src.name} 副本`,
        stationIds: [...src.stationIds],
      };
      d.lines.push(copy);
      d.activeLineId = copy.id;
      return d;
    });
  };

  const reverseLine = (id) => {
    patch((d) => {
      const l = d.lines.find((x) => x.id === id);
      if (l) l.stationIds = [...l.stationIds].reverse();
      return d;
    });
  };

  /** 按位置给线路排序：沿主方向 (x 或 y) 排 */
  const sortLine = (id) => {
    patch((d) => {
      const l = d.lines.find((x) => x.id === id);
      if (!l) return d;
      const pts = l.stationIds.map((sid) => d.stations.find((s) => s.id === sid)).filter(Boolean);
      if (pts.length < 2) return d;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      const key = spanX >= spanY ? 'x' : 'y';
      l.stationIds = [...pts].sort((a, b) => a[key] - b[key]).map((p) => p.id);
      return d;
    });
  };

  const deleteLine = (id) => {
    patch((d) => {
      if (d.lines.length <= 1) return d;
      d.lines = d.lines.filter((l) => l.id !== id);
      if (d.activeLineId === id) d.activeLineId = d.lines[0].id;
      return d;
    });
  };

  const removeStationFromLine = (lineId, stationId) => {
    patch((d) => {
      d.lines = d.lines.map((l) => (l.id === lineId
        ? { ...l, stationIds: l.stationIds.filter((s) => s !== stationId) }
        : l));
      return d;
    });
  };

  const moveStationInLine = (lineId, index, dir) => {
    patch((d) => {
      const line = d.lines.find((l) => l.id === lineId);
      if (!line) return d;
      const j = index + dir;
      if (j < 0 || j >= line.stationIds.length) return d;
      const arr = [...line.stationIds];
      [arr[index], arr[j]] = [arr[j], arr[index]];
      line.stationIds = arr;
      return d;
    });
  };

  const addText = () => {
    const t = newText(doc.canvas.width / 2, 120, '线路网标题');
    patch((d) => { d.texts.push(t); return d; });
    setSelectedText(t.id);
    setSelectedStation(null);
  };

  const deleteText = (id) => {
    patch((d) => { d.texts = d.texts.filter((t) => t.id !== id); return d; });
    setSelectedText(null);
  };

  const updateCanvas = (changes) => {
    patch((d) => { d.canvas = { ...d.canvas, ...changes }; return d; });
  };

  const updateBackground = (changes) => {
    patch((d) => { d.canvas.background = { ...d.canvas.background, ...changes }; return d; });
  };

  const loadDocInto = (d) => {
    setDoc(normalizeDoc(d));
    setSelectedStation(null);
    setSelectedText(null);
  };

  const fitZoom = useCallback(() => {
    const w = window.innerWidth - 168 - 320 - 56;
    const h = window.innerHeight - 62 - 52;
    const s = Math.min(w / doc.canvas.width, h / doc.canvas.height);
    setZoom(Math.max(0.08, Math.min(1.5, +s.toFixed(3))));
  }, [doc.canvas.width, doc.canvas.height]);

  // 初始放大：首次进入时自动缩放到适合窗口，避免 6000×4000 画布一进来只看到左上角
  useEffect(() => {
    if (zoomInited) return;
    fitZoom();
    setZoomInited(true);
  }, [zoomInited, fitZoom]);

  // 键盘：Delete 删选中，Esc 取消选择
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStation) { e.preventDefault(); deleteStation(selectedStation); }
        else if (selectedText) { e.preventDefault(); deleteText(selectedText); }
      }
      if (e.key === 'Escape') { setSelectedStation(null); setSelectedText(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedStation, selectedText]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 导出 SVG / PNG */
  const exportImage = (kind) => {
    const svg = canvasRef.current?.querySelector('svg.metro-canvas');
    if (!svg) return;
    const text = buildSvgString(svg);
    if (kind === 'svg') {
      const blob = new Blob([text], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name || '线路图'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    // PNG：画到 canvas 再导出
    const img = new Image();
    const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = doc.canvas.width;
      c.height = doc.canvas.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = `${doc.name || '线路图'}.png`;
        a.click();
        URL.revokeObjectURL(u);
      }, 'image/png');
    };
    img.src = url;
  };

  return (
    <div className="metro-app">
      <header className="metro-header">
        <div className="brand">
          <span className="logo">🚇</span>
          <div>
            <h1>地铁线路设计器</h1>
            <p className="muted small">
              {doc.lines.length} 条线路 · {doc.stations.length} 个站点
              {doc.stations.length > 0 && ` · ${doc.stations.filter((s) => doc.lines.filter((l) => l.stationIds.includes(s.id)).length > 1).length} 个换乘站`}
            </p>
          </div>
        </div>

        <input
          className="doc-name"
          value={doc.name}
          onChange={(e) => patch((d) => { d.name = e.target.value; return d; })}
          aria-label="线路网名称"
        />

        <div className="toolbar">
          <button className={`toolbar-btn ${adding ? 'on' : ''}`} onClick={() => setAdding((v) => !v)} title="开启后点击画布空白处即可添加站点">
            {adding ? '✏️ 加站中' : '🖐 仅选择'}
          </button>
          <div className="zoom-ctl">
            <button onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.1).toFixed(2)))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>+</button>
            <button onClick={fitZoom} title="缩放到适合窗口">适应</button>
            <button onClick={() => setZoom(1)}>1:1</button>
          </div>
          <SavePanel doc={doc} onLoad={loadDocInto} />
          <button className="toolbar-btn" onClick={() => exportImage('png')} title="导出 PNG 图片">⬇ PNG</button>
          <button className="toolbar-btn" onClick={() => exportImage('svg')} title="导出 SVG 矢量图">⬇ SVG</button>
          <button className="toolbar-btn" onClick={() => loadDocInto(createDemoDoc())}>📐 示例</button>
        </div>
      </header>

      <div className="metro-body">
        <BackgroundPicker
          doc={doc}
          city={city}
          setCity={setCity}
          onChange={(t) => updateBackground({ type: t })}
          onTileZoom={(z) => updateBackground({ type: 'tiles', mapZoom: z, tileZoom: Math.floor(z) })}
          onPickCity={(code, c, t) => updateBackground({
            type: 'city',
            cityCode: code,
            centerLon: c.lon,
            centerLat: c.lat,
          })}
          status={bgState}
        />

        <main className="canvas-wrap">
          <div className="canvas-scroll" ref={canvasRef}>
            <MetroCanvas
              doc={doc}
              selectedStation={selectedStation}
              selectedLine={doc.activeLineId}
              selectedText={selectedText}
              onPickStation={setSelectedStation}
              onPickText={setSelectedText}
              onPickLine={(id) => patch((d) => { d.activeLineId = id; return d; })}
              onMoveStation={moveStation}
              onMoveText={moveText}
              background={background}
              zoom={zoom}
              onCanvasClick={onCanvasClick}
            />
          </div>
        </main>

        <Inspector
          doc={doc}
          activeLine={activeLine}
          selectedStation={station}
          selectedText={selectedText}
          onUpdateLine={updateLine}
          onUpdateStation={updateStation}
          onUpdateText={updateText}
          onUpdateCanvas={updateCanvas}
          onUpdateBackground={updateBackground}
          onDeleteStation={deleteStation}
          onDeleteLine={deleteLine}
          onAddLine={addLine}
          onSetActiveLine={(id) => patch((d) => { d.activeLineId = id; return d; })}
          onRemoveStationFromLine={removeStationFromLine}
          onMoveStationInLine={moveStationInLine}
          onAddText={addText}
          onDeleteText={deleteText}
          onDuplicateLine={duplicateLine}
          onReverseLine={reverseLine}
          onSortLine={sortLine}
          city={city}
          setCity={setCity}
          bgStatus={bgState}
          onReloadBg={() => setBgNonce((n) => n + 1)}
        />
      </div>
    </div>
  );
}

function BackgroundPicker({ doc, city, setCity, onChange, onPickCity, onTileZoom, status }) {
  const type = doc.canvas.background.type;
  const bg = doc.canvas.background;
  const curCity = CITIES.find((c) => c.code === (bg.cityCode || city)) || CITIES[0];
  const mapZoom = Number.isFinite(Number(bg.mapZoom)) ? Number(bg.mapZoom) : (Number(bg.tileZoom) || 15);

  return (
    <aside className="bg-picker">
      <h3>背景</h3>

      <button className={`bg-opt ${type === 'white' ? 'on' : ''}`} onClick={() => onChange('white')}>
        <span className="bg-swatch white" />
        白色画布
      </button>

      <button className={`bg-opt ${type === 'tiles' ? 'on' : ''}`} onClick={() => onChange('tiles')}>
        <span className="bg-swatch tiles" />
        街道级地图
      </button>

      {(type === 'tiles' || type === 'city') && (
        <>
          <select
            value={bg.cityCode || city}
            onChange={(e) => {
              const code = e.target.value;
              const c = CITIES.find((x) => x.code === code) || CITIES[0];
              setCity(code);
              onPickCity(code, c, type);
            }}
            aria-label="选择城市"
          >
            {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </>
      )}

      {type === 'tiles' && (
        <>
          <label className="bg-label">
            放大地图 <b>{mapZoom.toFixed(1)}</b>
            <small className="muted">（{zoomHintOf(mapZoom)}）</small>
          </label>
          <input
            type="range"
            className="map-zoom-slider"
            min={10}
            max={18}
            step={0.1}
            value={mapZoom}
            onChange={(e) => onTileZoom(Number(e.target.value))}
            aria-label="放大地图"
          />
          <div className="zoom-quick">
            {ZOOM_HINTS.map((h) => (
              <button
                key={h.z}
                className={`tile-zoom-btn ${Math.floor(mapZoom) === h.z ? 'on' : ''}`}
                onClick={() => onTileZoom(h.z)}
              >
                {h.label}
              </button>
            ))}
          </div>
          <p className="muted small">
            z={mapZoom.toFixed(1)} · 路网{mapZoom >= 16 ? '非常详细' : mapZoom >= 14 ? '详细' : mapZoom >= 12 ? '粗略' : '很粗略'}
            <br />中心 {curCity.lon.toFixed(3)}, {curCity.lat.toFixed(3)}
          </p>
          <button className="bg-opt tiny" onClick={() => onChange('white')}>切回白纸（省流量）</button>
        </>
      )}

      <button className={`bg-opt ${type === 'city' ? 'on' : ''}`} onClick={() => onChange('city')}>
        <span className="bg-swatch city" />
        区县轮廓
      </button>

      <button className={`bg-opt ${type === 'china' ? 'on' : ''}`} onClick={() => onChange('china')}>
        <span className="bg-swatch china" />
        中国全图
      </button>

      {status.status === 'loading' && <p className="muted small">地图加载中…</p>}
      {status.status === 'error' && <p className="err-line small">{status.error}</p>}
      {(type === 'city' || type === 'china') && status.status === 'ready' && status.detail && (
        <p className="muted small">{status.detail}</p>
      )}
      <p className="muted small">提示：点「适应」让整张图进入视野；画布尺寸可在右侧「画布」调大。</p>
    </aside>
  );
}
