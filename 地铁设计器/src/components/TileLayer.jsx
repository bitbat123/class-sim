import React, { useMemo } from 'react';
import { lonLatToTile, tileUrl } from '../tiles.js';

/**
 * 街道级底图：把栅格瓦片铺到画布上。
 *
 * 「放大地图」的核心：
 *   mapZoom 是连续值（例如 15.37）。
 *   - 整数部分 15 决定用哪一级瓦片（路网详细度由它决定：z 越大，路网越密）
 *   - 小数部分 0.37 只是把瓦片放大显示（视觉放大，不增加细节）
 *   所以在 15.0 → 15.99 之间连续拉，瓦片编号不变，只是越来越"糊"；
 *   跨过 16.0 时换用 z=16 的瓦片，路网立刻变详细。
 */
export default function TileLayer({ bg, canvasW, canvasH }) {
  const mapZoom = Number.isFinite(Number(bg.mapZoom))
    ? Number(bg.mapZoom)
    : (Number(bg.tileZoom) || 15);

  const z = Math.max(3, Math.min(18, Math.floor(mapZoom)));
  // 视觉放大倍数：小数部分 + 用户手动 scale
  const subScale = 2 ** (mapZoom - z);
  const userScale = bg.tileScale || 1;
  const scale = subScale * userScale;
  const opacity = bg.tileOpacity ?? 1;

  const plan = useMemo(() => {
    const center = lonLatToTile(bg.centerLon, bg.centerLat, z);
    const cx = center.x * 256;
    const cy = center.y * 256;

    const halfW = canvasW / 2;
    const halfH = canvasH / 2;

    // 画布覆盖的世界像素范围（缩放越大，覆盖越少）
    const left = cx - halfW / scale;
    const right = cx + halfW / scale;
    const top = cy - halfH / scale;
    const bottom = cy + halfH / scale;

    const maxTile = 2 ** z;
    const minTX = Math.floor(left / 256);
    const maxTX = Math.floor(right / 256);
    const minTY = Math.max(0, Math.floor(top / 256));
    const maxTY = Math.min(maxTile - 1, Math.floor(bottom / 256));

    const tiles = [];
    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const wrapX = ((tx % maxTile) + maxTile) % maxTile;
        const px = (tx * 256 - cx) * scale + halfW;
        const py = (ty * 256 - cy) * scale + halfH;
        tiles.push({
          key: `${wrapX}_${ty}_${z}`,
          url: tileUrl(wrapX, ty, z),
          x: px,
          y: py,
          size: 256 * scale + 0.8,   // +0.8 消除瓦片缝隙
        });
      }
    }
    return { tiles };
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
        />
      ))}
    </g>
  );
}
