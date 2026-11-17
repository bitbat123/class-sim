// 炸弹人游戏规则（纯逻辑，无 DOM）。服务端与浏览器共用，保证结果一致。
import { Interpreter, Pair, parse, BombError, TimeLimitError } from './interp.js';
import { MAPS } from './maps.js';

export const DIRS = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] }; // 上右下左
export const DIR_NAMES = ['上', '右', '下', '左'];
export const BOMB_RANGE = 2;     // 炸弹向四个方向炸开的格数
export const BOMB_FUSE = 3;      // 放下后几回合爆炸
export const BOMB_COOLDOWN = 1;  // 放完炸弹后至少间隔的回合
export const ENEMY_MOVE_EVERY = 2;   // 敌人每 2 回合动一次
// 赛制（与比赛规则一致）：
// - 编写代码阶段 20 分钟（由服务端计时，不在这里）；
// - 每局：先死者输；超过 ROUND_SECONDS 未结束，放炸弹少的一方赢；
// - 三局两胜（best of 3）。
export const ROUND_SECONDS = 120;      // 一局的时间上限：2 分钟
export const ROUNDS_TO_WIN = 2;        // 两胜即赢得整场
export const MAX_ROUNDS = 3;           // 最多三局
// 以“回合”计的上限：每回合约代表一次动作的时间片（由服务端按 ROUND_SECONDS 换算）
export const ROUND_TURN_CAP = 300;

export function createMatch(mapIndex) {
  const def = MAPS[mapIndex];
  if (!def) throw new Error('没有这张地图');
  const grid = def.rows.map((r) => r.split(''));
  const enemies = [];
  const players = [];
  grid.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === 'P') { players.push({ x, y }); row[x] = '.'; }
    if (ch === 'E') { enemies.push({ x, y, alive: true }); row[x] = '.'; }
  }));
  return {
    mapIndex,
    grid,
    width: def.rows[0].length,
    height: def.rows.length,
    turn: 0,
    over: false,
    result: null,
    // 每个玩家：{ pos, alive, score, cooldown, dirChoice, bombRequest }
    players: players.slice(0, 2).map((p, i) => ({
      id: i,
      x: p.x,
      y: p.y,
      alive: true,
      score: 0,
      bombsPlaced: 0,      // 放炸弹次数：时间到时用于判定
      cooldown: 0,
      dirChoice: -1,       // 脚本本回合设置的方向：-1 表示不动
      bombRequest: false,  // 脚本本回合设置的放炸弹请求
      lastError: null,
    })),
    enemies,
    bombs: [],           // { x, y, fuse, owner }
    explosions: [],      // { cells: [[x,y],...] } 本回合爆炸的格子（用于画面）
    events: [],          // 本回合文字事件（用于日志）
    log: [],
  };
}

/** 某格是否会被现有炸弹炸到（与 step() 的爆炸范围规则一致，墙会挡住爆炸） */
function inDanger(m, x, y) {
  for (const b of m.bombs) {
    if (b.x === x && b.y === y) return true;
    for (const [dx, dy] of Object.values(DIRS)) {
      for (let r = 1; r <= BOMB_RANGE; r++) {
        const cx = b.x + dx * r;
        const cy = b.y + dy * r;
        if (wall(m, cx, cy)) break;
        if (cx === x && cy === y) return true;
      }
    }
  }
  return false;
}

const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.width && y < m.height;
const wall = (m, x, y) => !inside(m, x, y) || m.grid[y][x] === '#';
const bombAt = (m, x, y) => m.bombs.find((b) => b.x === x && b.y === y);

/** 一回合的规则结算。玩家的 dirChoice / bombRequest 应在调用前由脚本写入。 */
export function step(m) {
  if (m.over) return m;
  m.turn++;
  m.explosions = [];
  m.events = [];

  // 1. 玩家移动（每回合最多一格；撞墙或被炸弹挡住则不动）
  for (const p of m.players) {
    if (!p.alive) continue;
    if (p.dirChoice >= 0 && DIRS[p.dirChoice]) {
      const [dx, dy] = DIRS[p.dirChoice];
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!wall(m, nx, ny) && !bombAt(m, nx, ny)) {
        p.x = nx;
        p.y = ny;
      }
    }
  }

  // 2. 玩家放炸弹
  for (const p of m.players) {
    if (!p.alive) continue;
    if (p.cooldown > 0) p.cooldown--;
    if (p.bombRequest && p.cooldown === 0 && !bombAt(m, p.x, p.y)) {
      m.bombs.push({ x: p.x, y: p.y, fuse: BOMB_FUSE, owner: p.id });
      p.bombsPlaced++;
      p.cooldown = BOMB_COOLDOWN;
      m.events.push(`玩家${p.id + 1} 放下炸弹`);
    }
    p.dirChoice = -1;
    p.bombRequest = false;
  }

  // 3. 敌人移动（每 ENEMY_MOVE_EVERY 回合动一次，朝最近玩家走一步）
  if (m.turn % ENEMY_MOVE_EVERY === 0) {
    for (const e of m.enemies) {
      if (!e.alive) continue;
      const target = nearestAlive(m, e);
      if (!target) continue;
      const options = [[0, -1], [1, 0], [0, 1], [-1, 0]]
        .map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }))
        .filter((c) => !wall(m, c.x, c.y) && !bombAt(m, c.x, c.y))
        .sort((a, b) => manhattan(a, target) - manhattan(b, target));
      if (options.length && manhattan(options[0], target) < manhattan(e, target)) {
        e.x = options[0].x;
        e.y = options[0].y;
      }
    }
  }

  // 4. 炸弹倒计时并爆炸
  const exploding = m.bombs.filter((b) => {
    b.fuse--;
    return b.fuse <= 0;
  });
  if (exploding.length) {
    const cells = new Set();
    for (const b of exploding) {
      cells.add(`${b.x},${b.y}`);
      for (const [dx, dy] of Object.values(DIRS)) {
        for (let r = 1; r <= BOMB_RANGE; r++) {
          const x = b.x + dx * r;
          const y = b.y + dy * r;
          if (wall(m, x, y)) break;
          cells.add(`${x},${y}`);
        }
      }
    }
    m.bombs = m.bombs.filter((b) => !exploding.includes(b));
    m.explosions = [...cells].map((s) => s.split(',').map(Number));
    for (const [x, y] of m.explosions) {
      // 炸到的玩家死亡；对方炸到自己 -> 扣分；炸到敌人得分
      for (const p of m.players) {
        if (p.alive && p.x === x && p.y === y) {
          p.alive = false;
          m.events.push(`玩家${p.id + 1} 被炸死`);
        }
      }
      for (const e of m.enemies) {
        if (e.alive && e.x === x && e.y === y) {
          e.alive = false;
          const owner = exploding.find((b) => cells.has(`${b.x},${b.y}`) && (b.x === x || b.y === y) && Math.abs(b.x - x) + Math.abs(b.y - y) <= BOMB_RANGE);
          const who = owner ? owner.owner : null;
          if (who !== null) m.players[who].score += 10;
          m.events.push(`敌人被炸掉（+10 分）`);
        }
      }
    }
  }

  // 5. 敌人碰到玩家也会被判死（简单规则：同格即死）
  for (const p of m.players) {
    if (!p.alive) continue;
    for (const e of m.enemies) {
      if (e.alive && e.x === p.x && e.y === p.y) {
        p.alive = false;
        m.events.push(`玩家${p.id + 1} 被敌人撞死`);
      }
    }
  }

  // 6. 结束判定（一局）：先死者输
  const alive = m.players.filter((p) => p.alive);
  if (alive.length === 0) {
    m.over = true;
    m.result = 'draw';              // 同时死亡
  } else if (alive.length === 1) {
    m.over = true;
    m.result = `player${alive[0].id + 1}`; // 另一人先死，存活者赢
    m.events.push(`玩家${m.players.find((p) => !p.alive).id + 1} 先死，玩家${alive[0].id + 1} 获胜`);
  } else if (m.turn >= ROUND_TURN_CAP) {
    // 2 分钟时间到：放炸弹少者胜
    m.over = true;
    m.result = winnerByBombCount(m);
    m.events.push('时间到（2 分钟），按放炸弹次数判定');
  }
  return m;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function nearestAlive(m, from) {
  let best = null;
  for (const p of m.players) {
    if (!p.alive) continue;
    if (!best || manhattan(p, from) < manhattan(best, from)) best = p;
  }
  return best;
}

/**
 * 一局（round）结束时的胜负：
 * - 先死者输：只剩一人存活时，剩下的人赢；两人同时死亡则平局。
 * - 超过 ROUND_SECONDS 仍未分出胜负：放炸弹少的一方赢，相同则平局。
 */
function winnerByBombCount(m) {
  const [a, b] = m.players;
  if (a.bombsPlaced === b.bombsPlaced) return 'draw';
  return a.bombsPlaced < b.bombsPlaced ? 'player1' : 'player2';
}

/** 一场比赛（best of 3）的状态：两局两胜制 */
export function newSeries() {
  return { rounds: [], wins: { player1: 0, player2: 0 }, over: false, winner: null };
}

/** 记录一局的结果，并判断整场是否已经分出胜负 */
export function recordRound(series, result) {
  series.rounds.push(result);
  if (result === 'player1' || result === 'player2') series.wins[result]++;
  if (series.wins.player1 >= ROUNDS_TO_WIN) { series.over = true; series.winner = 'player1'; }
  else if (series.wins.player2 >= ROUNDS_TO_WIN) { series.over = true; series.winner = 'player2'; }
  else if (series.rounds.length >= MAX_ROUNDS) {
    series.over = true;
    series.winner = series.wins.player1 === series.wins.player2
      ? 'draw'
      : (series.wins.player1 > series.wins.player2 ? 'player1' : 'player2');
  }
  return series;
}

// ---------------- 对外的 bomb:: 视图（只读 + 两个可写） ----------------
// 脚本能写的只有 dir 与 bomb；其余一律只读。

export const WRITABLE = { player_dir: 'int', player_bomb: 'bool' };

/** 给一个玩家生成 bomb:: 宿主接口（脚本运行的沙盒） */
export function makeHost(m, playerId) {
  const me = m.players[playerId];
  const other = m.players[1 - playerId];
  const enemyPositions = () => m.enemies.filter((e) => e.alive).map((e) => new Pair(e.x, e.y));
  const bombList = () => m.bombs.map((b) => new Pair(b.x, b.y));
  const mapRows = () => m.grid.map((r) => r.join(''));

  const readers = {
    player_pos: () => new Pair(me.x, me.y),
    enemy_pos: () => enemyPositions(),
    bomb_pos: () => bombList(),
    other_pos: () => new Pair(other.x, other.y),
    map_w: () => m.width,
    map_h: () => m.height,
    wall_pos: () => {
      const out = [];
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.grid[y][x] === '#') out.push(new Pair(x, y));
      return out;
    },
    my_score: () => me.score,
    other_score: () => other.score,
    turn: () => m.turn,
    is_alive: () => me.alive,
    cooldown: () => me.cooldown,
    player_dir: () => me.dirChoice,
    player_bomb: () => me.bombRequest,
  };
  const funcs = {
    can_move: (args) => {
      const d = args[0];
      if (!DIRS[d]) return false;
      const [dx, dy] = DIRS[d];
      const nx = me.x + dx;
      const ny = me.y + dy;
      return !wall(m, nx, ny) && !bombAt(m, nx, ny);
    },
    is_wall: (args) => wall(m, args[0], args[1]),
    dist: (args) => {
      const [a, b] = args;
      return Math.abs(a.first - b.first) + Math.abs(a.second - b.second);
    },
    // 某格是否在现有炸弹的爆炸范围内（与 step() 的爆炸规则一致）
    in_danger: (args) => inDanger(m, args[0].first, args[0].second),
    // 是否存在一个可走的相邻格，并且这个格子不在爆炸范围内
    can_retreat: () => {
      for (const [dx, dy] of Object.values(DIRS)) {
        const x = me.x + dx;
        const y = me.y + dy;
        if (!wall(m, x, y) && !bombAt(m, x, y) && !inDanger(m, x, y)) return true;
      }
      return false;
    },
  };

  return {
    read(name, line) {
      if (!(name in readers)) throw new BombError(`bomb::${name} 不存在`, line);
      return readers[name]();
    },
    writableType(name) {
      return WRITABLE[name] ? (name === 'player_dir' ? 'int' : 'bool') : null;
    },
    write(name, value) {
      if (name === 'player_dir') me.dirChoice = value;
      if (name === 'player_bomb') me.bombRequest = value;
    },
    call(name, args, line) {
      if (!(name in funcs)) throw new BombError(`bomb::${name}() 不存在`, line);
      return funcs[name](args);
    },
  };
}

/**
 * 运行一次脚本的一帧 main()。返回 { ok, error, timeout }。
 * 脚本运行出错或超时，该玩家本回合视为“不动、不放炸弹”，并记录错误。
 */
export function runScriptFrame(m, playerId, interp) {
  const p = m.players[playerId];
  p.lastError = null;
  p.dirChoice = -1;
  p.bombRequest = false;
  if (!p.alive || !interp) return { ok: true };
  try {
    interp.runMain(makeHost(m, playerId));
    return { ok: true };
  } catch (e) {
    p.dirChoice = -1;
    p.bombRequest = false;
    if (e instanceof TimeLimitError) return { ok: false, timeout: true, error: e.message, line: e.line };
    if (e instanceof BombError) return { ok: false, error: e.message, line: e.line };
    return { ok: false, error: '内部错误：' + (e && e.message) };
  }
}

export function loadScript(src) {
  const ast = parse(src);
  return new Interpreter(ast);
}

export { Pair, parse, BombError, TimeLimitError };
