// 校验 10 张地图：尺寸一致、墙壁占比 10%–15%、两个玩家出生点、至少 1 个敌人。
import { MAPS } from '../shared/maps.js';

let ok = true;
MAPS.forEach((m, i) => {
  const h = m.rows.length;
  const w = m.rows[0].length;
  const sameWidth = m.rows.every((r) => r.length === w);
  const cells = h * w;
  const walls = m.rows.join('').split('').filter((c) => c === '#').length;
  const pct = (walls / cells) * 100;
  const players = m.rows.join('').split('').filter((c) => c === 'P').length;
  const enemies = m.rows.join('').split('').filter((c) => c === 'E').length;
  const problems = [];
  if (!sameWidth) problems.push('行宽不一致');
  if (pct < 10 || pct > 15) problems.push(`墙壁占比 ${pct.toFixed(1)}% 不在 10–15% 之间`);
  if (players !== 2) problems.push(`玩家出生点应为 2 个，实际 ${players}`);
  if (enemies < 1) problems.push('至少需要 1 个敌人');
  const line = `${m.name}: ${w}x${h}, 墙 ${pct.toFixed(1)}%, P=${players}, E=${enemies}`;
  if (problems.length) {
    ok = false;
    console.log('FAIL ' + line + ' -> ' + problems.join('; '));
  } else {
    console.log('PASS ' + line);
  }
});
console.log(ok ? '\nALL MAPS OK' : '\nSOME MAPS FAILED');
process.exit(ok ? 0 : 1);
