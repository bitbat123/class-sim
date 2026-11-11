import { SCORE_BANDS, SCORE_BANDS_150 } from '../constants.js';

/** 压力颜色：绿(≤50) → 黄(≤100) → 红(≤250) → 深红(>250) */
export function pressureColor(p) {
  if (p <= 50) return '#22c55e';
  if (p <= 100) return '#eab308';
  if (p <= 250) return '#ef4444';
  return '#7f1d1d';
}

/** 分数颜色：150 分制用 SCORE_BANDS_150 的分数段；100 分制用 SCORE_BANDS 的百分比分段 */
export function scoreColor(score, max) {
  if (max === 150) {
    const band = SCORE_BANDS_150.find((b) => score < b.max) || SCORE_BANDS_150[SCORE_BANDS_150.length - 1];
    return band.color;
  }
  const pct = (score / max) * 100;
  const band = SCORE_BANDS.find((b) => pct < b.max) || SCORE_BANDS[SCORE_BANDS.length - 1];
  return band.color;
}
