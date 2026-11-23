import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MetroCanvas from './components/MetroCanvas.jsx';
import Inspector from './components/Inspector.jsx';
import SavePanel from './components/SavePanel.jsx';
import {
  createDoc, createDemoDoc, normalizeDoc, newStation, newLine, saveDoc, loadDoc, PALETTE,
} from './model.js';
import { CITIES, CHINA_CODE } from './cities.js';
import { loadBackground, fitToCanvas } from './background.js';

const DEFAULT_LINE_NAMES = ['1 号线', '2 号线', '3 号线'];

export default function App() {
  const [doc, setDoc] = useState(() => {
    const last = loadDoc('auto');
    if (last) return last.doc;
    return createDemoDoc();
  });
  const [selectedStation, setSelectedStation] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [bgState, setBgState] = useState({ status: 'idle', data: null, error: null });
  const [adding, setAdding] = useState(true);   // 点击画布即可加站
  const [city, setCity] = useState('310000');
  const autoSaveTimer = useRef(null);

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
  useEffect(() => {
    if (bgType === 'white') { setBgState({ status: 'ready', data: null, error: null }); return; }
    const code = bgType === 'china' ? CHINA_CODE : city;
    let alive = true;
    setBgState({ status: 'loading', data: null, error: null });
    loadBackground(code)
      .then((data) => { if (alive) setBgState({ status: 'ready', data, error: null }); })
      .catch((e) => { if (alive) setBgState({ status: 'error', data: null, error: e.message }); });
    return () => { alive = false; };
  }, [bgType, city]);

  const background = useMemo(() => {
    if (!bgState.data) return null;
    return fitToCanvas(bgState.data, doc.canvas.width, doc.canvas.height, 80);
  }, [bgState.data, doc.canvas.width, doc.canvas.height]);

  // ---- 文档操作 ----
  const patch = useCallback((fn) => setDoc((d) => normalizeDoc(fn(structuredClone(d)))), []);

  const addStationAt = (x, y) => {
    const st = newStation(x, y, `新站${doc.stations.length + 1}`);
    setDoc((d) => {
      const next = structuredClone(d);
      next.stations.push(st);
      const line = next.lines.find((l) => l.id === next.activeLineId) || next.lines[0];
      if (line) line.stationIds.push(st.id);
      next.activeLineId = line ? line.id : next.activeLineId;
      return next;
    });
    setSelectedStation(st.id);
  };

  const onCanvasClick = (e) => {
    if (!adding) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    addStationAt(Math.round(local.x), Math.round(local.y));
  };

  const updateLine = (id, changes) => {
    patch((d) => {
      d.lines = d.lines.map((l) => (l.id === id ? { ...l, ...changes } : l));
      return d;
    });
  };

  const updateStation = (id, changes) => {
    patch((d) => {
      d.stations = d.stations.map((s) => (s.id === id ? { ...s, ...changes } : s));
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

  const updateCanvas = (changes) => {
    patch((d) => { d.canvas = { ...d.canvas, ...changes }; return d; });
  };

  const setBackgroundType = (type) => {
    patch((d) => {
      d.canvas.background = { ...d.canvas.background, type };
      if (type === 'city') d.canvas.background.cityCode = city;
      return d;
    });
  };

  const loadDocInto = (d) => {
    setDoc(normalizeDoc(d));
    setSelectedStation(null);
  };

  return (
    <div className="metro-app">
      <header className="metro-header">
        <div className="brand">
          <span className="logo">🚇</span>
          <div>
            <h1>地铁线路设计器</h1>
            <p className="muted small">{doc.lines.length} 条线路 · {doc.stations.length} 个站点</p>
          </div>
        </div>

        <input
          className="doc-name"
          value={doc.name}
          onChange={(e) => patch((d) => { d.name = e.target.value; return d; })}
          aria-label="线路网名称"
        />

        <div className="toolbar">
          <button
            className={`toolbar-btn ${adding ? 'on' : ''}`}
            onClick={() => setAdding((v) => !v)}
            title="开启后点击画布空白处即可添加站点"
          >
            {adding ? '✏️ 加站中' : '🖐 仅选择'}
          </button>
          <ZoomControl zoom={zoom} setZoom={setZoom} onFit={() => {
            const w = window.innerWidth - 168 - 300 - 48;
            const h = window.innerHeight - 62 - 48;
            const s = Math.min(w / doc.canvas.width, h / doc.canvas.height);
            setZoom(Math.max(0.2, Math.min(1.5, +s.toFixed(2))));
          }} />
          <SavePanel doc={doc} onLoad={loadDocInto} />
          <button className="toolbar-btn" onClick={() => loadDocInto(createDemoDoc())}>📐 示例</button>
          <button
            className="toolbar-btn"
            onClick={() => {
              const d = createDoc();
              d.activeLineId = d.lines[0].id;
              loadDocInto(d);
            }}
          >
            🗑 清空
          </button>
        </div>
      </header>

      <div className="metro-body">
        <BackgroundPicker
          doc={doc}
          city={city}
          setCity={setCity}
          onChange={setBackgroundType}
          status={bgState}
        />

        <main className="canvas-wrap">
          <div className="canvas-scroll">
            <MetroCanvas
              doc={doc}
              selectedStation={selectedStation}
              selectedLine={doc.activeLineId}
              onPickStation={setSelectedStation}
              onPickLine={(id) => patch((d) => { d.activeLineId = id; return d; })}
              onMoveStation={moveStation}
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
          onUpdateLine={updateLine}
          onUpdateStation={updateStation}
          onUpdateCanvas={updateCanvas}
          onDeleteStation={deleteStation}
          onDeleteLine={deleteLine}
          onAddLine={addLine}
          onSetActiveLine={(id) => patch((d) => { d.activeLineId = id; return d; })}
          onRemoveStationFromLine={removeStationFromLine}
          onMoveStationInLine={moveStationInLine}
        />
      </div>
    </div>
  );
}

function ZoomControl({ zoom, setZoom, onFit }) {
  return (
    <div className="zoom-ctl">
      <button onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}>−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>+</button>
      <button onClick={onFit} title="缩放到适合窗口">适应</button>
      <button onClick={() => setZoom(1)}>1:1</button>
    </div>
  );
}

function BackgroundPicker({ doc, city, setCity, onChange, status }) {
  const type = doc.canvas.background.type;
  return (
    <aside className="bg-picker">
      <h3>背景</h3>

      <button className={`bg-opt ${type === 'white' ? 'on' : ''}`} onClick={() => onChange('white')}>
        <span className="bg-swatch white" />
        白色画布
      </button>

      <button className={`bg-opt ${type === 'city' ? 'on' : ''}`} onClick={() => onChange('city')}>
        <span className="bg-swatch city" />
        中国城市
      </button>

      {type === 'city' && (
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            onChange('city');
          }}
          aria-label="选择城市"
        >
          {CITIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      )}

      <button className={`bg-opt ${type === 'china' ? 'on' : ''}`} onClick={() => onChange('china')}>
        <span className="bg-swatch china" />
        中国全图
      </button>

      {status.status === 'loading' && <p className="muted small">地图加载中…</p>}
      {status.status === 'error' && <p className="err-line small">{status.error}</p>}
      {type !== 'white' && status.status === 'ready' && (
        <p className="muted small">背景仅作参考，不影响导出。</p>
      )}
    </aside>
  );
}
