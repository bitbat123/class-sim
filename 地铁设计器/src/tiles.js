// 瓦片地图：用高德栅格瓦片（webrd）拼出街道级底图。
// 高德瓦片带 Access-Control-Allow-Origin: *，可以直接在浏览器里当图片用。
// 坐标系用 Web 墨卡托（与高德瓦片一致，偏移在国内可忽略不计）；
// 区县边界（DataV）用的是 WGS84，两者在国内约有 100–700 米偏差，但在示意图尺度下不明显。

const TILE_HOSTS = ['webrd01', 'webrd02', 'webrd03', 'webrd04'];

/** 经纬度 → 瓦片坐标（浮点，含小数部分） */
export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** 瓦片坐标 → 经纬度 */
export function tileToLonLat(x, y, z) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lon, lat: (latRad * 180) / Math.PI };
}

/** 单张瓦片的 URL（按 x+y 轮换 4 个镜像，避免单域名限流） */
export function tileUrl(x, y, z) {
  const host = TILE_HOSTS[Math.abs(x + y) % TILE_HOSTS.length];
  return `https://${host}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`;
}

/**
 * 计算画布上铺满所需的瓦片列表。
 * @returns {{ tiles: Array<{x,y,z,left,top,size}>, zoom: number, spanKm: number }}
 */
export function planTiles({ canvasW, canvasH, centerLon, centerLat, zoom, padding = 40 }) {
  const z = Math.round(zoom);
  // 求画布需要的经纬度跨度：反解出画布四角对应的瓦片坐标
  const center = lonLatToTile(centerLon, centerLat, z);
  const scale = 2 ** z;

  // 每像素对应的瓦片单位数：假设 1 张瓦片的显示尺寸是 256px
  const tilePx = 256;
  const maxTilesX = Math.ceil(canvasW / tilePx) + 2;
  const maxTilesY = Math.ceil(canvasH / tilePx) + 2;

  const startX = Math.floor(center.x) - Math.floor(maxTilesX / 2);
  const startY = Math.floor(center.y) - Math.floor(maxTilesY / 2);

  const tiles = [];
  for (let dy = 0; dy < maxTilesY; dy++) {
    for (let dx = 0; dx < maxTilesX; dx++) {
      const tx = startX + dx;
      const ty = startY + dy;
      if (ty < 0 || ty >= scale) continue;
      const wrapX = ((tx % scale) + scale) % scale;
      tiles.push({
        x: wrapX,
        y: ty,
        z,
        left: dx * tilePx - (center.x - Math.floor(center.x)) * tilePx,
        top: dy * tilePx - (center.y - Math.floor(center.y)) * tilePx,
        size: tilePx,
      });
    }
  }

  // 估算覆盖范围（用于显示提示）
  const nw = tileToLonLat(startX, startY, z);
  const se = tileToLonLat(startX + maxTilesX, startY + maxTilesY, z);
  const spanKm = Math.round(
    Math.abs(se.lat - nw.lat) * 111 + Math.abs(se.lon - nw.lon) * 111 * Math.cos((centerLat * Math.PI) / 180),
  ) / 2;

  return { tiles, zoom: z, spanKm, offset: { left: tiles.length ? tiles[0].left : 0, top: tiles.length ? tiles[0].top : 0 } };
}

/** zoom 大致对应的覆盖范围（公里），给用户选级用 */
export const ZOOM_HINTS = [
  { z: 11, label: '全市', km: '≈60 km' },
  { z: 12, label: '大区', km: '≈30 km' },
  { z: 13, label: '城区', km: '≈15 km' },
  { z: 14, label: '街区', km: '≈8 km' },
  { z: 15, label: '详细街区', km: '≈4 km' },
  { z: 16, label: '街道级', km: '≈2 km' },
  { z: 17, label: '超详细', km: '≈1 km' },
];
