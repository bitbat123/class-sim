// 下载并精简地图数据到 public/geo/ 下，避免线上直接请求 DataV 被防盗链拦截（403）。
// 用法：node scripts/fetch-geo.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { CITIES, CHINA_CODE } from '../src/cities.js';

const OUT = new URL('../public/geo/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const PICK = ['name', 'center', 'centroid'];

/** 坐标保留 4 位小数（约 11 米精度，画示意图完全够） */
const round = (v) => Math.round(v * 1e4) / 1e4;

function simplifyGeom(geom) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])),
    };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)]))),
    };
  }
  return geom;
}

async function fetchOne(code, file, label) {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${file}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'metro-designer-build/1.0' } });
  if (!res.ok) throw new Error(`${code} ${res.status}`);
  const json = await res.json();

  const out = {
    type: 'FeatureCollection',
    features: (json.features || []).map((f) => {
      const props = {};
      for (const k of PICK) if (f.properties?.[k] !== undefined) props[k] = f.properties[k];
      return { type: 'Feature', properties: props, geometry: simplifyGeom(f.geometry) };
    }),
  };

  const text = JSON.stringify(out);
  writeFileSync(new URL(`${code}.json`, OUT), text);
  console.log(`${label.padEnd(8)} ${code}  ${(text.length / 1024).toFixed(0)} KB`);
}

await fetchOne(CHINA_CODE, `${CHINA_CODE}_full`, '中国全图');
for (const c of CITIES) {
  try {
    await fetchOne(c.code, c.code, c.name);
  } catch (e) {
    console.error(`跳过 ${c.name}（${c.code}）：${e.message}`);
  }
}
console.log('完成');
