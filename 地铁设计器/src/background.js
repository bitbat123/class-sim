// 背景地图：优先读本地 public/geo 下的精简 GeoJSON（构建时用 scripts/fetch-geo.mjs 生成），
// 本地没有时才回退到阿里云 DataV（线上会被防盗链 403，所以只作兜底）。
import { CHINA_CODE } from './cities.js';

const cache = new Map();   // adcode -> { paths, names, aspect }

/** 简易墨卡托投影：纬度做 y 压缩，让中国地图看起来比例正常。返回 0..1 归一化坐标 */
function project(lon, lat) {
  const x = (lon + 180) / 360;
  const latRad = (lat * Math.PI) / 180;
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI);
  return [x, y];
}

/** 把 GeoJSON 里所有多边形坐标抽出来 */
function extractRings(geojson) {
  const rings = [];
  const pushPolygon = (coords) => { for (const ring of coords) rings.push(ring); };
  const walk = (geom) => {
    if (!geom) return;
    if (geom.type === 'Polygon') pushPolygon(geom.coordinates);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(pushPolygon);
    else if (geom.type === 'GeometryCollection') geom.geometries.forEach(walk);
  };
  if (geojson.type === 'FeatureCollection') geojson.features.forEach((f) => walk(f.geometry));
  else if (geojson.type === 'Feature') walk(geojson.geometry);
  else walk(geojson);
  return rings;
}

/** 取显示名称（省 / 区县名）+ 中心点 */
function extractNames(geojson) {
  if (geojson.type !== 'FeatureCollection') return [];
  return geojson.features
    .map((f) => ({
      name: f.properties?.name || '',
      center: f.properties?.center || f.properties?.centroid || null,
    }))
    .filter((x) => x.name && x.center);
}

/** 取 GeoJSON：先本地打包数据，失败再回退 DataV */
async function fetchGeo(code) {
  const local = `${import.meta.env.BASE_URL}geo/${code}.json`;
  try {
    const res = await fetch(local);
    if (res.ok) return await res.json();
  } catch { /* 继续回退 */ }

  const remote = code === CHINA_CODE
    ? `https://geo.datav.aliyun.com/areas_v3/bound/${CHINA_CODE}_full.json`
    : `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
  const res = await fetch(remote, { referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`地图数据加载失败（${res.status}），请确认 public/geo/${code}.json 存在`);
  return res.json();
}

/**
 * 加载背景数据，返回可绘制的路径（已投影到 0..1 归一化坐标）。
 * @param {string} code adcode，例如 '310000'；'100000' 表示全国
 */
export async function loadBackground(code) {
  const key = code === CHINA_CODE ? CHINA_CODE : code;
  if (cache.has(key)) return cache.get(key);

  const geojson = await fetchGeo(key);
  const rings = extractRings(geojson);
  if (!rings.length) throw new Error('地图数据为空');

  // 全国图会带上南海诸岛，把包围盒拉得很扁；过滤掉太南的部分让大陆撑满画布
  const usable = key === CHINA_CODE
    ? rings.filter((ring) => {
      const lat = ring.reduce((a, p) => a + p[1], 0) / (ring.length || 1);
      return lat > 3.5;
    })
    : rings;
  const useRings = usable.length ? usable : rings;

  const projected = useRings.map((ring) => ring.map(([lon, lat]) => project(lon, lat)));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of projected) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const paths = projected.map((ring) => ring.map(([x, y]) => [(x - minX) / w, (y - minY) / h]));

  const names = extractNames(geojson).map((n) => {
    const [px, py] = project(n.center[0], n.center[1]);
    const nx = (px - minX) / w;
    const ny = (py - minY) / h;
    return { name: n.name, x: nx, y: ny, visible: nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 };
  }).filter((n) => n.visible);

  const result = { paths, names, aspect: (maxX - minX) / (maxY - minY) };
  cache.set(key, result);
  return result;
}

/**
 * 把归一化路径映射到画布坐标。
 * fit='contain' 等比缩放并居中（整张地图都看得到）
 * fit='cover'   等比放大铺满画布（地图细节更大，边缘会被裁掉）
 * fit='manual'  用 scale + offset 手动变换
 */
export function fitToCanvas(bg, canvasW, canvasH, cfg = {}) {
  const { fit = 'contain', scale = 1, offsetX = 0, offsetY = 0, padding = 60 } = cfg;
  const aspect = bg.aspect || 1;

  let drawW;
  let drawH;
  let ox;
  let oy;

  if (fit === 'cover') {
    // 铺满：取较大的缩放比，保证宽高都盖住画布
    const byW = canvasW / 1;
    const byH = canvasH * aspect;
    drawW = Math.max(byW, byH);
    drawH = drawW / aspect;
    ox = (canvasW - drawW) / 2;
    oy = (canvasH - drawH) / 2;
  } else if (fit === 'manual') {
    drawW = canvasW * 0.9 * scale;
    drawH = drawW / aspect;
    ox = (canvasW - drawW) / 2 + offsetX;
    oy = (canvasH - drawH) / 2 + offsetY;
  } else {
    const availW = canvasW - padding * 2;
    const availH = canvasH - padding * 2;
    if (availW <= 0 || availH <= 0) return { paths: [], names: [] };
    drawW = Math.min(availW, availH * aspect);
    drawH = drawW / aspect;
    ox = (canvasW - drawW) / 2;
    oy = (canvasH - drawH) / 2;
  }

  const map = ([x, y]) => [ox + x * drawW, oy + y * drawH];

  return {
    paths: bg.paths.map((ring) => ring.map(map)),
    names: bg.names.map((n) => {
      const nx = ox + n.x * drawW;
      const ny = oy + n.y * drawH;
      return {
        name: n.name,
        x: nx,
        y: ny,
        visible: nx >= 0 && nx <= canvasW && ny >= 0 && ny <= canvasH,
      };
    }),
  };
}
