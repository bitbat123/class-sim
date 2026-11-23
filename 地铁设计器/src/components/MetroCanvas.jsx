import React from 'react';
import { autoLabelPos } from '../model.js';

/**
 * 线路画布（SVG）。
 * - 站点是圆点，换乘站画成白底黑圈
 * - 线路按 stationIds 顺序连线，支持折线拐角圆角
 * - 线宽、颜色、花纹可编辑
 * - 站名标签可放 8 个方向，也可用自定义偏移
 */

const WRAP = 8;   // 站名换行宽度（字符数）

function wrapText(text, perLine = WRAP) {
  if (!text) return [];
  const out = [];
  for (let i = 0; i < text.length; i += perLine) out.push(text.slice(i, i + perLine));
  return out;
}

/** 计算线宽对应的描边定义 */
function patternProps(pattern, width, color, id) {
  switch (pattern) {
    case 'dashed':
      return { stroke: color, strokeWidth: width, strokeDasharray: `${width * 2} ${width * 1.2}` };
    case 'dotted':
      return { stroke: color, strokeWidth: width, strokeDasharray: `${width * 0.1} ${width * 1.1}`, strokeLinecap: 'round' };
    case 'dashdot':
      return { stroke: color, strokeWidth: width, strokeDasharray: `${width * 2.2} ${width} ${width * 0.1} ${width}` };
    case 'double':
      return { stroke: color, strokeWidth: width };
    case 'stripe':
      return { stroke: `url(#${id}-stripe)`, strokeWidth: width };
    case 'zigzag':
      return { stroke: `url(#${id}-zigzag)`, strokeWidth: width };
    default:
      return { stroke: color, strokeWidth: width };
  }
}

/** 把相邻站点连成一条带圆角的折线路径 */
function polylinePath(points, radius = 14) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    const v1 = { x: cur.x - prev.x, y: cur.y - prev.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const r = Math.min(radius, l1 / 2, l2 / 2);

    const p1 = { x: cur.x - (v1.x / l1) * r, y: cur.y - (v1.y / l1) * r };
    const p2 = { x: cur.x + (v2.x / l2) * r, y: cur.y + (v2.y / l2) * r };
    d += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/** 站名的锚点与对齐方式 */
function labelAnchor(pos, dx, dy) {
  const OFF = 16;
  switch (pos) {
    case 'top': return { x: 0, y: -OFF, anchor: 'middle', base: 'auto' };
    case 'bottom': return { x: 0, y: OFF + 12, anchor: 'middle', base: 'auto' };
    case 'left': return { x: -OFF, y: 4, anchor: 'end', base: 'auto' };
    case 'right': return { x: OFF, y: 4, anchor: 'start', base: 'auto' };
    case 'topleft': return { x: -OFF, y: -OFF, anchor: 'end', base: 'auto' };
    case 'topright': return { x: OFF, y: -OFF, anchor: 'start', base: 'auto' };
    case 'bottomleft': return { x: -OFF, y: OFF + 12, anchor: 'end', base: 'auto' };
    case 'bottomright': return { x: OFF, y: OFF + 12, anchor: 'start', base: 'auto' };
    case 'custom': return { x: dx, y: dy, anchor: dx >= 0 ? 'start' : 'end', base: 'auto' };
    default: return { x: OFF, y: 4, anchor: 'start', base: 'auto' };
  }
}

export default function MetroCanvas({
  doc, selectedStation, selectedLine, onPickStation, onPickLine, onMoveStation, background, zoom, onCanvasClick,
}) {
  const { width, height } = doc.canvas;
  const stationById = React.useMemo(
    () => Object.fromEntries(doc.stations.map((s) => [s.id, s])),
    [doc.stations],
  );

  // 每个站被哪些线路使用（决定是否换乘、以及自动标签方向）
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

  const onPointerDown = (e, st) => {
    if (e.button !== 0) return;
    onPickStation?.(st.id);
    const svg = e.currentTarget.ownerSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    dragRef.current = { id: st.id, dx: st.x - local.x, dy: st.y - local.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    if (!svg.createSVGPoint) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    dragRef.current.moved = true;
    onMoveStation?.(dragRef.current.id, local.x + dragRef.current.dx, local.y + dragRef.current.dy);
  };

  const onPointerUp = () => { dragRef.current = null; };

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

      {/* 背景 */}
      <rect width={width} height={height} fill={doc.canvas.background.type === 'white' ? '#ffffff' : '#f8fafc'} />

      {background && background.paths && (
        <g className="metro-bg">
          {background.paths.map((ring, i) => (
            <path
              key={i}
              d={ring.map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z'}
              fill="rgba(148,163,184,0.13)"
              stroke="rgba(100,116,139,0.45)"
              strokeWidth="1.2"
            />
          ))}
          {doc.canvas.background.type === 'china' && background.names && background.names.map((n, i) => (
            <text key={i} x={n.x} y={n.y} className="metro-bg-name">{n.name}</text>
          ))}
        </g>
      )}

      {doc.canvas.showGrid && (
        <g opacity="0.16">
          {Array.from({ length: Math.floor(width / 80) }, (_, i) => (
            <line key={`v${i}`} x1={i * 80} y1={0} x2={i * 80} y2={height} stroke="#94a3b8" strokeWidth="1" />
          ))}
          {Array.from({ length: Math.floor(height / 80) }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 80} x2={width} y2={i * 80} stroke="#94a3b8" strokeWidth="1" />
          ))}
        </g>
      )}

      {/* 线路 */}
      {doc.lines.filter((l) => l.visible).map((line) => {
        const pts = line.stationIds.map((id) => stationById[id]).filter(Boolean);
        if (pts.length < 2) return null;
        const props = patternProps(line.pattern, line.width, line.color, line.id);
        const isSel = selectedLine === line.id;
        return (
          <g key={line.id} className="metro-line" onClick={(e) => { e.stopPropagation(); onPickLine?.(line.id); }}>
            {isSel && (
              <path d={polylinePath(pts)} fill="none" stroke={line.color} strokeWidth={line.width + 8} opacity="0.22" strokeLinejoin="round" strokeLinecap="round" />
            )}
            <path d={polylinePath(pts)} fill="none" {...props} strokeLinejoin="round" strokeLinecap="round" style={{ cursor: 'pointer' }} />
          </g>
        );
      })}

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

        return (
          <g key={st.id}>
            {isSel && <circle cx={st.x} cy={st.y} r={17} fill="none" stroke="#f59e0b" strokeWidth="3" />}
            <circle
              cx={st.x}
              cy={st.y}
              r={isInterchange ? 9 : 7}
              fill={isInterchange ? '#ffffff' : (lines[0] ? (doc.lines.find((l) => l.id === lines[0])?.color || '#0f172a') : '#0f172a')}
              stroke={isInterchange ? '#0f172a' : '#ffffff'}
              strokeWidth={isInterchange ? 3.5 : 2}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => onPointerDown(e, st)}
              onClick={(e) => { e.stopPropagation(); onPickStation?.(st.id); }}
            />
            {st.name && (
              <text
                x={st.x + a.x}
                y={st.y + a.y}
                textAnchor={a.anchor}
                className={`metro-label ${st.open ? '' : 'closed'}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onPickStation?.(st.id); }}
              >
                {labelLines.map((ln, i) => (
                  <tspan key={i} x={st.x + a.x} dy={i === 0 ? 0 : 14}>{ln}</tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
