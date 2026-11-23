import React, { useMemo } from 'react';
import { lonLatToTile, tileUrl } from '../tiles.js';

/**
 * 街道级底图：把高德栅格瓦片铺到画布上。
 * 瓦片是 Web 墨卡托，这里按「世界像素 = 瓦片坐标 × 256」的规则映射到画布。
 *
 * @param {object} bg   doc.canvas.background
 * @param {number} canvasW/H  画布尺寸
 */
export default function TileLayer({ bg, canvasW, canvasH }) {
  const z = Math.max(3, Math.min(18, Math.round(bg.tileZoom || 15)));
  const scale = bg.tileScale || 1;
  const opacity = bg.tileOpacity ?? 1;

  const plan = useMemo(() => {
    const worldSize = 256 * 2 ** z;                 // 整个世界在当前 z 下的像素宽度
    const center = lonLatToTile(bg.centerLon, bg.centerLat, z);
    const cx = center.x * 256;
    const cy = center.y * 256;

    // 画布中心对准 (cx, cy)，再乘 scale
    const halfW = canvasW / 2;
    const halfH = canvasH / 2;

    // 需要覆盖的世界像素范围
    const left = cx - halfW / scale;
    const right = cx + halfW / scale;
    const top = cy - halfH / scale;
    const bottom = cy + halfH / scale;

    const minTX = Math.floor(left / 256);
    const maxTX = Math.floor(right / 256);
    const minTY = Math.max(0, Math.floor(top / 256));
    const maxTY = Math.min(2 ** z - 1, Math.floor(bottom / 256));

    const tiles = [];
    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const wx = ((tx % (2 ** z)) + 2 ** z) % (2 ** z);
        const px = (tx * 256 - cx) * scale + halfW;
        const py = (ty * 256 - cy) * scale + halfH;
        tiles.push({
          key: `${tx}_${ty}_${z}`,
          url: tileUrl(wx, ty, z),
          x: px,
          y: py,
          size: 256 * scale + 0.6,   // +0.6 消除瓦片间缝隙
        });
      }
    }
    return { tiles, worldSize };
  }, [z, scale, bg.centerLon, bg.centerLat, canvasW, canvasH]);

  return (
    <g className="tile-layer" opacity={opacity} style={{ pointerEvents: 'none' }}>
      {plan.tiles.map((t) => (
        <image
          key={t.key}
          href={t.url}
          x={t.x}
          y={t.y}
          width={t.size}
          height={t.size}
          preserveAspectRatio="none"
          crossOrigin="anonymous"
        />
      ))}
    </g>
  );
}
