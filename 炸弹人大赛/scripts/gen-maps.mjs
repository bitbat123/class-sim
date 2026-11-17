// 一次性工具：用固定种子生成 10 张地图，并把结果打印成字面量。
// 生成结果会写入 shared/maps.js（那里是硬编码字符串，运行时不生成任何东西）。
// 没有外墙：越界视为墙（见 game.js 的 wall()），所以墙壁占比可以精确控制在 10%–15%。
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 15;
const H = 11;
const TOTAL = W * H;
const TARGET = Math.round(TOTAL * 0.12); // 约 12%，在 10–15% 之内
const SPAWNS = [[0, 0], [W - 1, H - 1]];

function connected(grid) {
  const open = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] !== '#') open.push([x, y]);
  if (open.length === 0) return false;
  const seen = new Set([`${open[0][0]},${open[0][1]}`]);
  const q = [open[0]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (grid[ny][nx] === '#' || seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen.size === open.length;
}

function generate(seed) {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const grid = Array.from({ length: H }, () => Array(W).fill('.'));
    // 玩家出生点：对角两角，并保证周围两格不是墙（保证开局能动）
    grid[SPAWNS[0][1]][SPAWNS[0][0]] = 'P';
    grid[SPAWNS[1][1]][SPAWNS[1][0]] = 'P';
    // 随机选 TARGET 个墙位，避开出生点及其周围
    const cand = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nearSpawn = SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 2);
        if (!nearSpawn) cand.push([x, y]);
      }
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    for (let i = 0; i < TARGET; i++) {
      const [x, y] = cand[i];
      grid[y][x] = '#';
    }
    if (!connected(grid)) continue;
    // 敌人：3 个，放在空地上，离两个玩家都至少 4 格
    const free = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (grid[y][x] !== '.') continue;
        const far = SPAWNS.every(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) >= 4);
        if (far) free.push([x, y]);
      }
    }
    if (free.length < 3) continue;
    for (let i = 0; i < 3; i++) {
      const j = i + Math.floor(rnd() * (free.length - i));
      [free[i], free[j]] = [free[j], free[i]];
      const [x, y] = free[i];
      grid[y][x] = 'E';
    }
    return grid.map((r) => r.join(''));
  }
  throw new Error('生成失败，种子 ' + seed);
}

const out = [];
for (let i = 1; i <= 10; i++) out.push(generate(1000 + i * 7919));
console.log(JSON.stringify(out, null, 2));
