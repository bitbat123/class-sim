// 浏览器端的本地模拟：不连服务端，直接用同一个引擎跑「我和基准程序」的对战。
// 用于编写阶段自测，结果也会生成录像（和联机一致的数据结构）。
import {
  createMatch, step, loadScript, runScriptFrame,
} from '@shared/game.js';
import { checkCode } from '@shared/game.js';

const SPEED_MS = 260;   // 默认放慢，6 回合的对局也能看清过程

/**
 * 跑一局本地对战。
 * @param {string} mySrc 我的代码
 * @param {string} oppSrc 对手（基准程序）代码
 * @param {number} mapIndex 地图
 * @returns {{frames: Array, result: string, turns: number, error?: string}}
 */
export function runLocalMatch(mySrc, oppSrc, mapIndex) {
  const myErrs = checkCode(mySrc);
  if (myErrs.length) return { frames: [], result: 'invalid', turns: 0, error: myErrs[0].message };
  const oppErrs = checkCode(oppSrc);
  if (oppErrs.length) return { frames: [], result: 'invalid', turns: 0, error: oppErrs[0].message };

  const m = createMatch(mapIndex);
  const mine = loadScript(mySrc);
  const theirs = loadScript(oppSrc);
  const frames = [];
  frames.push({ type: 'round-start', snapshot: snap(m) });

  let guard = 0;
  while (!m.over && guard++ < 400) {
    const a = runScriptFrame(m, 0, mine);
    const b = runScriptFrame(m, 1, theirs);
    step(m);
    frames.push({
      type: 'turn',
      turn: m.turn,
      snapshot: snap(m),
      errors: {
        player1: a.ok ? null : a,
        player2: b.ok ? null : b,
      },
      console: {
        player1: a.console || [],
        player2: b.console || [],
      },
    });
  }
  return { frames, result: m.result, turns: m.turn, error: null };
}

export function snap(m) {
  return {
    turn: m.turn,
    mapIndex: m.mapIndex,
    width: m.width,
    height: m.height,
    grid: m.grid.map((r) => r.join('')),
    players: m.players.map((p) => ({ x: p.x, y: p.y, alive: p.alive, bombsPlaced: p.bombsPlaced })),
    enemies: m.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y })),
    bombs: m.bombs.map((b) => ({ x: b.x, y: b.y, fuse: b.fuse, owner: b.owner })),
    explosions: m.explosions,
    events: m.events,
    over: m.over,
    result: m.result,
  };
}

export { SPEED_MS };
