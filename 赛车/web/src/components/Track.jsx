import React from 'react';

const SCALE = 0.055;   // 世界单位 → 像素
const H = 640;         // 画布高度
const W = 360;         // 画布宽度
const MID = W / 2;

/** 赛车画面：把赛道（中心线 + 边界）与两辆车画成 2D 俯视图 */
export default function Track({ snapshot, title }) {
  if (!snapshot) {
    return (
      <div className="board-empty"><p className="muted">{title || '赛道'}：等待开始…</p></div>
    );
  }

  const { track, cars, tick, over, result } = snapshot;
  const totalLen = track.length;
  const halfW = track.width / 2;

  // 赛道轮廓：每条采样点画成一条横向的线段（左右边界）
  const segments = track.samples.map(([cx, p]) => {
    const yPix = H - p * H;
    const left = MID + (cx - halfW) * SCALE * 2;
    const right = MID + (cx + halfW) * SCALE * 2;
    return { yPix, left, right, cx };
  });

  // 把每辆车换算成屏幕坐标
  const toScreen = (car) => ({
    x: MID + car.x * SCALE * 2,
    y: H - (car.y / totalLen) * H,
  });

  return (
    <div className="track-wrap">
      {title && <div className="board-title">{title}</div>}
      <svg width={W} height={H} className="track-svg" role="img" aria-label="赛道">
        <rect x="0" y="0" width={W} height={H} fill="#0b1220" />
        {segments.map((s, i) => {
          const next = segments[i + 1];
          if (!next) return null;
          const pts = [
            `${s.left},${s.yPix}`,
            `${next.left},${next.yPix}`,
            `${next.right},${next.yPix}`,
            `${s.right},${s.yPix}`,
          ].join(' ');
          return <polygon key={i} points={pts} fill="#334155" />;
        })}
        {/* 中心虚线 */}
        {segments.map((s, i) => (
          i % 2 === 0
            ? <line key={`c${i}`} x1={MID + s.cx * SCALE * 2} y1={s.yPix} x2={MID + s.cx * SCALE * 2} y2={s.yPix} stroke="#fbbf24" strokeWidth="2" />
            : null
        ))}
        {/* 起终点线 */}
        <line x1="0" y1={H - 2} x2={W} y2={H - 2} stroke="#22c55e" strokeWidth="3" />
        <line x1="0" y1="2" x2={W} y2="2" stroke="#ef4444" strokeWidth="3" />

        {cars.map((car) => {
          const pos = toScreen(car);
          const color = car.id === 0 ? '#22d3ee' : '#fb923c';
          return (
            <g key={car.id}>
              {car.trail.slice(-40).map(([tx, ty], i) => (
                <circle key={i} cx={MID + tx * SCALE * 2} cy={H - (ty / totalLen) * H} r="2" fill={color} opacity="0.25" />
              ))}
              <rect
                x={pos.x - 6} y={pos.y - 10} width="12" height="20" rx="3"
                fill={car.offTrack ? '#7f1d1d' : color}
                stroke={car.finished ? '#fbbf24' : '#0b1220'}
                strokeWidth="2"
              />
              <text x={pos.x + 10} y={pos.y + 4} fill={color} fontSize="11">{car.id + 1}</text>
            </g>
          );
        })}
      </svg>

      <div className="board-meta muted small">
        帧 {tick} · 车1 进度 {Math.round((cars[0]?.progress ?? 0) * 100)}% · 车2 进度 {Math.round((cars[1]?.progress ?? 0) * 100)}%
        {over && <strong> · 结果：{result === 'car1' ? '车1 胜' : result === 'car2' ? '车2 胜' : '平局'}</strong>}
      </div>
    </div>
  );
}
