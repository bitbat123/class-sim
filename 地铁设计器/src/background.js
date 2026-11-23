// 背景地图：从阿里云 DataV 拉取行政区划 GeoJSON，投影到画布坐标。
// 数据来源 https://geo.datav.aliyun.com/areas_v3/bound/<adcode>.json（带 CORS，可直接前端请求）
import { CHINA_CODE } from './cities.js';

const cache = new Map();   // adcode -> { paths, bounds }

/**
 * 简易墨卡托投影：纬度做 y 压缩，让中国地图看起来比例正常。
 * 返回 [x, y]，范围归一化到 0..1。
 */
function project(lon, lat) {
  const x = (lon + 180) / 360;
  const latRad = (lat * Math.PI) / 180;
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI);
  return [x, y];
}

/** 把 GeoJSON 里的所有多边形坐标抽出来，做一次整体归一化 */
function extractRings(geojson) {
  const rings = [];
  const pushPolygon = (coords) => {
    for (const ring of coords) rings.push(ring);
  };

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

/** 取 GeoJSON 的显示名称列表（省 / 市辖区名），用于标注 */
function extractNames(geojson) {
  if (geojson.type !== 'FeatureCollection') return [];
  return geojson.features
    .map((f) => ({
      name: f.properties?.name || '',
      center: f.properties?.center || f.properties?.centroid || null,
    }))
    .filter((x) => x.name && x.center);
}

/**
 * 加载背景数据，返回可直接绘制的路径（已投影到 0..1 的归一化坐标）。
 * @param {string} code adcode，例如 '310000'；'100000' 表示全国
 */
export async function loadBackground(code) {
  const key = code === CHINA_CODE ? CHINA_CODE : code;
  if (cache.has(key)) return cache.get(key);

  // 中国全图用 _full 版本，才能拿到省级边界与省名；城市用普通版本（市级轮廓）
  const file = key === CHINA_CODE ? `${CHINA_CODE}_full` : key;
  const res = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${file}.json`);
  if (!res.ok) throw new Error(`地图数据加载失败（${res.status}）`);
  const geojson = await res.json();

  const rings = extractRings(geojson);
  if (!rings.length) throw new Error('地图数据为空');

  // 全国图会带上南海诸岛，把包围盒拉得很扁；这里过滤掉太南的小岛，让大陆撑满画布
  const usable = key === CHINA_CODE
    ? rings.filter((ring) => {
      const lat = ring.reduce((a, p) => a + p[1], 0) / (ring.length || 1);
      return lat > 3.5;
    })
    : rings;
  const useRings = usable.length ? usable : rings;

  // 先全部投影，再算包围盒
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

  // 归一化到 0..1，保持长宽比
  const paths = projected.map((ring) => ring.map(([x, y]) => [(x - minX) / w, (y - minY) / h]));

  const names = extractNames(geojson).map((n) => {
    const [px, py] = project(n.center[0], n.center[1]);
    return { name: n.name, x: (px - minX) / w, y: (py - minY) / h };
  });

  const result = { paths, names, aspect: (maxX - minX) / (maxY - minY) };
  cache.set(key, result);
  return result;
}

/**
 * 把归一化路径适配到画布：等比缩放并居中，留出边距。
 * 返回 { paths: [[ [x,y], ... ]], names, scale }
 */
export function fitToCanvas(bg, canvasW, canvasH, padding = 60) {
  const availW = canvasW - padding * 2;
  const availH = canvasH - padding * 2;
  if (availW <= 0 || availH <= 0) return { paths: [], names: [] };

  // 归一化路径宽高都是 1，但实际长宽比由 aspect 决定
  const scale = Math.min(availW, availH * bg.aspect) / 1;
  const drawW = scale;
  const drawH = scale / (bg.aspect || 1);
  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;

  const map = ([x, y]) => [offsetX + x * drawW, offsetY + y * drawH];

  return {
    paths: bg.paths.map((ring) => ring.map(map)),
    names: bg.names.map((n) => ({ name: n.name, x: offsetX + n.x * drawW, y: offsetY + n.y * drawH })),
  };
}
