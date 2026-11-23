// 下载并精简地图数据到 public/geo/ 下，避免线上直接请求 DataV 被防盗链拦截（403）。
// 城市用 _full 版本（区/县边界，比城市轮廓详细得多），全国用 _full（省级边界）。
// 用法：node scripts/fetch-geo.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { CITIES, CHINA_CODE } from '../src/cities.js';

const OUT = new URL('../public/geo/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const PICK = ['name', 'center', 'centroid'];

/** 坐标保留 3 位小数（约 110 米精度，画线路示意图完全够） */
const round = (v) => Math.round(v * 1e3) / 1e3;

/** 环面积（度数近似），用来丢掉太小的岛屿碎片 */
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
  }
  return Math.abs(a / 2);
}

const MIN_AREA = 0.0008;   // 约 8 平方公里

function simplifyRing(ring) {
  if (ringArea(ring) < MIN_AREA) return null;
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const last = out[out.length - 1];
    const p = [round(lon), round(lat)];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out.length >= 4 ? out : null;
}

function simplifyGeom(geom) {
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates.map(simplifyRing).filter(Boolean);
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates
      .map((poly) => poly.map(simplifyRing).filter(Boolean))
      .filter((poly) => poly.length);
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }
  return null;
}

async function fetchOne(code, file, label) {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${file}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'metro-designer-build/2.0' } });
  if (!res.ok) throw new Error(`${code} ${res.status}`);
  const json = await res.json();

  const features = [];
  for (const f of json.features || []) {
    const geom = simplifyGeom(f.geometry);
    if (!geom) continue;
    const props = {};
    for (const k of PICK) if (f.properties?.[k] !== undefined) props[k] = f.properties[k];
    features.push({ type: 'Feature', properties: props, geometry: geom });
  }
  if (!features.length) throw new Error('没有可用要素');

  const text = JSON.stringify({ type: 'FeatureCollection', features });
  writeFileSync(new URL(`${code}.json`, OUT), text);
  console.log(`${label.padEnd(8)} ${code}  ${(text.length / 1024).toFixed(0)} KB  ${features.length} 个区`);
}

await fetchOne(CHINA_CODE, `${CHINA_CODE}_full`, '中国全图');
for (const c of CITIES) {
  try {
    await fetchOne(c.code, `${c.code}_full`, c.name);
  } catch (e) {
    console.error(`跳过 ${c.name}（${c.code}）：${e.message}`);
  }
}
console.log('完成');
