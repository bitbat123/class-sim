import React from 'react';
import { autoLabelPos } from '../model.js';
import TileLayer from './TileLayer.jsx';

/**
 * 线路画布（SVG）v2。
 * - 站点支持 4 种形状、独立字号、标签 8 方向 / 自定义偏移 / 旋转
 * - 线路支持环线（首尾相连）、平滑曲线、透明度、7 种花纹
 * - 文字标注可拖动
 * - 背景支持透明度、缩放、平移
 */

const WRAP = 7;   // 站名换行宽度（中文字符数）

function wrapText(text, perLine = WRAP) {
  if (!text) return [];
  const out = [];
  for (let i = 0; i < text.length; i += perLine) out.push(text.slice(i, i + perLine));
  return out;
}

/** 花纹 → SVG 描边属性 */
function patternProps(pattern, width, color, id) {
  switch (pattern) {
    case 'dashed':
      return { stroke: color, strokeWidth: width, strokeDasharray: `${width * 2} ${width * 1.2}` };
    case 'dotted':
      return { stroke: color, strokeWidth: width, strokeDasharray: `${Math.max(0.1, width * 0.1)} ${width * 1.1}`, strokeLinecap: 'round' };
    case 'dashdot':
      return { stroke: color, strokeWidth: width, strokeDasharray: `${width * 2.2} ${width} ${width * 0.1} ${width}` };
    case 'stripe':
      return { stroke: `url(#${id}-stripe)`, strokeWidth: width };
    case 'zigzag':
      return { stroke: `url(#${id}-zigzag)`, strokeWidth: width };
    default:
      return { stroke: color, strokeWidth: width };
  }
}

/** 生成路径：curve=0 时用折角，>0 时用平滑曲线 */
function linePath(points, { loop = false, curve = 0 } = {}) {
  const pts = loop && points.length >= 3 ? [...points, points[0]] : points;
  if (pts.length < 2) return '';

  if (curve > 0) {
    const k = Math.min(1, curve) * 0.5;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) * k;
      const c1y = p1.y + (p2.y - p0.y) * k;
      const c2x = p2.x - (p3.x - p1.x) * k;
      const c2y = p2.y - (p3.y - p1.y) * k;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    if (loop) d += ' Z';
    return d;
  }

  const radius = 14;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const v1 = { x: cur.x - prev.x, y: cur.y - prev.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const a = { x: cur.x - (v1.x / l1) * r, y: cur.y - (v1.y / l1) * r };
    const b = { x: cur.x + (v2.x / l2) * r, y: cur.y + (v2.y / l2) * r };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  if (loop) d += ' Z';
  return d;
}

/** 站名锚点 */
function labelAnchor(pos, dx, dy) {
  const OFF = 16;
  switch (pos) {
    case 'top': return { x: 0, y: -OFF, anchor: 'middle' };
    case 'bottom': return { x: 0, y: OFF + 12, anchor: 'middle' };
    case 'left': return { x: -OFF, y: 4, anchor: 'end' };
    case 'right': return { x: OFF, y: 4, anchor: 'start' };
    case 'topleft': return { x: -OFF, y: -OFF, anchor: 'end' };
    case 'topright': return { x: OFF, y: -OFF, anchor: 'start' };
    case 'bottomleft': return { x: -OFF, y: OFF + 12, anchor: 'end' };
    case 'bottomright': return { x: OFF, y: OFF + 12, anchor: 'start' };
    case 'custom': return { x: dx, y: dy, anchor: dx >= 0 ? 'start' : 'end' };
    default: return { x: OFF, y: 4, anchor: 'start' };
  }
}

/** 站点形状渲染 */
function StationShape({ st, r, fill, stroke, strokeWidth }) {
  const common = { fill, stroke, strokeWidth, style: { cursor: 'grab' }, className: 'metro-station' };
  switch (st.shape) {
    case 'square': {
      const s = r * 1.7;
      return <rect x={st.x - s / 2} y={st.y - s / 2} width={s} height={s} rx={2} {...common} />;
    }
    case 'diamond': {
      const s = r * 1.5;
      const pts = `${st.x},${st.y - s} ${st.x + s},${st.y} ${st.x},${st.y + s} ${st.x - s},${st.y}`;
      return <polygon points={pts} {...common} />;
    }
    case 'pill': {
      const w = r * 3.6;
      const h = r * 1.7;
      return <rect x={st.x - w / 2} y={st.y - h / 2} width={w} height={h} rx={h / 2} {...common} />;
    }
    default:
      return <circle cx={st.x} cy={st.y} r={r} {...common} />;
  }
}

export default function MetroCanvas({
  doc, selectedStation, selectedLine, selectedText,
  onPickStation, onPickLine, onPickText, onMoveStation, onMoveText,
  background, zoom, onCanvasClick,
}) {
  const { width, height } = doc.canvas;
  const stationById = React.useMemo(
    () => Object.fromEntries(doc.stations.map((s) => [s.id, s])),
    [doc.stations],
  );

  const stationLines = React.useMemo(() => {
    const map = new Map();
    for (const line of doc.lines) {
      for (const id of line.stationIds) {
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(line.id);
      }
    }
    return map;
  }, [doc.lines]);

  const dragRef = React.useRef(null);

  const toLocal = (svg, clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const startDrag = (e, kind, id, obj) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    const local = toLocal(svg, e.clientX, e.clientY);
    dragRef.current = {
      kind, id,
      dx: obj.x - local.x,
      dy: obj.y - local.y,
      snap: doc.canvas.snap || 0,
    };
    if (kind === 'station') onPickStation?.(id);
    if (kind === 'text') onPickText?.(id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const svg = e.currentTarget;
    if (!svg.createSVGPoint) return;
    const local = toLocal(svg, e.clientX, e.clientY);
    let x = local.x + drag.dx;
    let y = local.y + drag.dy;
    if (drag.snap > 0 && !e.altKey) {
      x = Math.round(x / drag.snap) * drag.snap;
      y = Math.round(y / drag.snap) * drag.snap;
    }
    if (drag.kind === 'station') onMoveStation?.(drag.id, x, y);
    else if (drag.kind === 'text') onMoveText?.(drag.id, x, y);
  };

  const onPointerUp = () => { dragRef.current = null; };

  const bg = doc.canvas.background;
  const bgOpacity = bg.opacity ?? 1;

  return (
    <svg
      className="metro-canvas"
      viewBox={`0 0 ${width} ${height}`}
      width={width * zoom}
      height={height * zoom}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onCanvasClick}
    >
      <defs>
        {doc.lines.map((l) => (
          <React.Fragment key={l.id}>
            <pattern id={`${l.id}-stripe`} width={l.width} height={l.width} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={l.width} height={l.width} fill={l.color} />
              <rect width={l.width / 2} height={l.width} fill="#ffffff" opacity="0.55" />
            </pattern>
            <pattern id={`${l.id}-zigzag`} width={l.width * 2} height={l.width * 2} patternUnits="userSpaceOnUse">
              <path
                d={`M 0 ${l.width * 2} L ${l.width} 0 L ${l.width * 2} ${l.width * 2}`}
                fill="none"
                stroke={l.color}
                strokeWidth={l.width}
              />
            </pattern>
          </React.Fragment>
        ))}
      </defs>

      <rect width={width} height={height} fill={bg.type === 'white' ? '#ffffff' : '#f8fafc'} />

      {/* 街道级瓦片底图 */}
      {bg.type === 'tiles' && (
        <TileLayer bg={bg} canvasW={width} canvasH={height} />
      )}

      {background && background.paths && (
        <g className="metro-bg" opacity={bgOpacity}>
          {background.paths.map((ring, i) => (
            <path
              key={i}
              d={ring.map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z'}
              fill="rgba(148,163,184,0.16)"
              stroke="rgba(71,85,105,0.5)"
              strokeWidth="1"
            />
          ))}
          {bg.showNames && background.names && background.names.filter((n) => n.visible).map((n, i) => (
            <text key={i} x={n.x} y={n.y} className="metro-bg-name" opacity={Math.min(1, bgOpacity * 1.6)}>{n.name}</text>
          ))}
        </g>
      )}

      {doc.canvas.showGrid && (
        <g opacity="0.14">
          {Array.from({ length: Math.floor(width / (doc.canvas.gridSize || 80)) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * doc.canvas.gridSize} y1={0} x2={i * doc.canvas.gridSize} y2={height} stroke="#94a3b8" strokeWidth="1" />
          ))}
          {Array.from({ length: Math.floor(height / (doc.canvas.gridSize || 80)) + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * doc.canvas.gridSize} x2={width} y2={i * doc.canvas.gridSize} stroke="#94a3b8" strokeWidth="1" />
          ))}
        </g>
      )}

      {/* 线路 */}
      {doc.lines.filter((l) => l.visible).map((line) => {
        const pts = line.stationIds.map((id) => stationById[id]).filter(Boolean);
        if (pts.length < 2) return null;
        const props = patternProps(line.pattern, line.width, line.color, line.id);
        const isSel = selectedLine === line.id;
        const d = linePath(pts, { loop: line.loop, curve: line.curve });
        return (
          <g key={line.id} className="metro-line" opacity={line.opacity ?? 1} onClick={(e) => { e.stopPropagation(); onPickLine?.(line.id); }}>
            {isSel && (
              <path d={d} fill="none" stroke={line.color} strokeWidth={line.width + 8} opacity="0.2" strokeLinejoin="round" strokeLinecap="round" />
            )}
            <path d={d} fill="none" {...props} strokeLinejoin="round" strokeLinecap="round" style={{ cursor: 'pointer' }} />
          </g>
        );
      })}

      {/* 文字标注 */}
      {doc.texts.map((t) => (
        <g key={t.id}>
          {selectedText === t.id && (
            <rect
              x={t.x - 6} y={t.y - t.size} width={Math.max(30, t.text.length * t.size * 0.75) + 12} height={t.size * 1.6}
              fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 4" rx="4"
            />
          )}
          <text
            x={t.x}
            y={t.y}
            fontSize={t.size}
            fontWeight={t.weight}
            fill={t.color}
            textAnchor={t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start'}
            transform={t.rotate ? `rotate(${t.rotate} ${t.x} ${t.y})` : undefined}
            className="metro-text"
            onPointerDown={(e) => startDrag(e, 'text', t.id, t)}
          >
            {t.text}
          </text>
        </g>
      ))}

      {/* 站点 */}
      {doc.stations.map((st) => {
        const lines = stationLines.get(st.id) || [];
        const isInterchange = lines.length > 1;
        const isSel = selectedStation === st.id;
        const neighborIds = [];
        for (const lid of lines) {
          const line = doc.lines.find((l) => l.id === lid);
          if (!line) continue;
          const idx = line.stationIds.indexOf(st.id);
          if (idx > 0) neighborIds.push(line.stationIds[idx - 1]);
          if (idx >= 0 && idx < line.stationIds.length - 1) neighborIds.push(line.stationIds[idx + 1]);
        }
        const neighbors = neighborIds.map((id) => stationById[id]).filter(Boolean);
        const pos = st.labelPos === 'auto' ? autoLabelPos(st, neighbors) : st.labelPos;
        const a = labelAnchor(pos, st.labelDx, st.labelDy);
        const labelLines = wrapText(st.name);
        const r = isInterchange ? 9 : 7;
        const mainColor = lines[0] ? (doc.lines.find((l) => l.id === lines[0])?.color || '#0f172a') : '#0f172a';

        return (
          <g key={st.id}>
            {isSel && <circle cx={st.x} cy={st.y} r={18} fill="none" stroke="#f59e0b" strokeWidth="3" />}
            <g onPointerDown={(e) => startDrag(e, 'station', st.id, st)} onClick={(e) => { e.stopPropagation(); onPickStation?.(st.id); }}>
              <StationShape
                st={st}
                r={r}
                fill={isInterchange ? '#ffffff' : mainColor}
                stroke={isInterchange ? '#0f172a' : '#ffffff'}
                strokeWidth={isInterchange ? 3.5 : 2}
              />
            </g>
            {st.name && (
              <text
                x={st.x + a.x}
                y={st.y + a.y}
                textAnchor={a.anchor}
                fontSize={st.fontSize}
                transform={st.rotate ? `rotate(${st.rotate} ${st.x + a.x} ${st.y + a.y})` : undefined}
                className={`metro-label ${st.open ? '' : 'closed'}`}
                onClick={(e) => { e.stopPropagation(); onPickStation?.(st.id); }}
              >
                {labelLines.map((ln, i) => (
                  <tspan key={i} x={st.x + a.x} dy={i === 0 ? 0 : st.fontSize * 1.15}>{ln}</tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
