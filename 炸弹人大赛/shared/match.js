// 对局状态机：编写阶段（20 分钟，可暂停）→ 双方同意 → 三局两胜。
// 纯逻辑，服务端与测试共用。时间用“已用毫秒”计，暂停时不增加，便于测试。
import { createMatch, step, newSeries, recordRound, ROUND_TURN_CAP } from './game.js';
import { loadScript, runScriptFrame } from './game.js';
import { checkCode } from './interp.js';

export const CODING_MS = 20 * 60 * 1000; // 编写代码 20 分钟

export const PHASE = {
  CODING: 'coding',       // 编写代码（计时，可暂停）
  CONSENT: 'consent',     // 编写结束，等待双方同意开始
  PLAYING: 'playing',     // 对局中
  FINISHED: 'finished',   // 整场结束
};

/** 创建一场比赛。mapOrder：10 张地图里选出的顺序（每局一张，不重复） */
export function createContest({ mapOrder }) {
  return {
    phase: PHASE.CODING,
    codingUsedMs: 0,       // 编写阶段已用时间
    paused: false,
    pauseCount: 0,
    consent: { player1: false, player2: false },
    code: { player1: '', player2: '' },
    codeErrors: { player1: [], player2: [] },
    series: newSeries(),
    mapOrder,
    round: null,           // 当前对局（createMatch 的结果）
    scripts: { player1: null, player2: null },
    replay: [],            // 录像：每回合的快照
    results: [],           // 每局的摘要
  };
}

/** 提交/更新代码（编写阶段任意时间都可以改，直到双方同意）。返回错误列表 */
export function setCode(c, player, src) {
  if (c.phase !== PHASE.CODING) return [{ line: 1, message: '编写阶段已结束' }];
  c.code[player] = src;
  c.codeErrors[player] = checkCode(src);
  return c.codeErrors[player];
}

/** 暂停 / 继续（只在编写阶段或对局中有效，暂停时时间不走） */
export function setPaused(c, paused) {
  if (c.phase === PHASE.FINISHED) return;
  if (paused && !c.paused) c.pauseCount++;
  c.paused = paused;
}

/** 推进编写阶段的计时。elapsedMs 是本次要加的时长，暂停时忽略 */
export function tickCoding(c, elapsedMs) {
  if (c.phase !== PHASE.CODING || c.paused) return false;
  c.codingUsedMs = Math.min(CODING_MS, c.codingUsedMs + elapsedMs);
  if (c.codingUsedMs >= CODING_MS) {
    c.phase = PHASE.CONSENT;
    return true;
  }
  return false;
}

/** 编写结束后，双方同意开始。只有两人都同意才会开第一局 */
export function setConsent(c, player, agree) {
  if (c.phase !== PHASE.CONSENT && c.phase !== PHASE.CODING) return { ok: false, message: '当前不能确认开始' };
  if (c.phase === PHASE.CODING) return { ok: false, message: '编写时间还没结束' };
  c.consent[player] = agree;
  if (c.consent.player1 && c.consent.player2) {
    const errs = [...c.codeErrors.player1, ...c.codeErrors.player2];
    if (errs.length) return { ok: false, message: '有代码语法错误，请先修正' };
    startRound(c);
    return { ok: true, started: true };
  }
  return { ok: true, started: false };
}

/** 开始一局：用 mapOrder 中的下一张地图，编译双方代码 */
export function startRound(c) {
  const roundIndex = c.series.rounds.length;
  if (roundIndex >= c.mapOrder.length) throw new Error('没有可用地图');
  const mapIndex = c.mapOrder[roundIndex];
  c.round = createMatch(mapIndex);
  c.scripts.player1 = loadScript(c.code.player1);
  c.scripts.player2 = loadScript(c.code.player2);
  c.phase = PHASE.PLAYING;
  c.consent = { player1: false, player2: false };
  c.replay.push({ type: 'round-start', round: roundIndex + 1, mapIndex, snapshot: snapshot(c.round) });
}

/** 对局中推进一回合：先运行双方脚本，再结算。超时/报错的玩家本回合不动。 */
export function playTurn(c) {
  if (c.phase !== PHASE.PLAYING || c.paused) return null;
  const m = c.round;
  const errs = {};
  const r1 = runScriptFrame(m, 0, c.scripts.player1);
  const r2 = runScriptFrame(m, 1, c.scripts.player2);
  if (!r1.ok) errs.player1 = r1;
  if (!r2.ok) errs.player2 = r2;
  step(m);
  const frame = { type: 'turn', turn: m.turn, snapshot: snapshot(m), errors: errs };
  c.replay.push(frame);
  if (m.over) finishRound(c);
  return frame;
}

function finishRound(c) {
  const m = c.round;
  const result = m.result === 'draw' ? 'draw' : m.result;
  recordRound(c.series, result);
  c.results.push({ round: c.series.rounds.length, mapIndex: m.mapIndex, result, turns: m.turn, bombs: m.players.map((p) => p.bombsPlaced) });
  c.replay.push({ type: 'round-end', round: c.series.rounds.length, result });
  if (c.series.over) {
    c.phase = PHASE.FINISHED;
    c.replay.push({ type: 'match-end', winner: c.series.winner, wins: c.series.wins });
  } else {
    // 下一局需要重新同意开始
    c.phase = PHASE.CONSENT;
    c.consent = { player1: false, player2: false };
  }
}

/** 一局超过 ROUND_TURN_CAP 时由 game.step 自动结束；这里保证不会无限进行 */
export function roundTurnBudget() {
  return ROUND_TURN_CAP;
}

/** 给前端看的快照（只读，不含脚本本身） */
export function snapshot(m) {
  return {
    turn: m.turn,
    mapIndex: m.mapIndex,
    width: m.width,
    height: m.height,
    grid: m.grid.map((r) => r.join('')),
    players: m.players.map((p) => ({ x: p.x, y: p.y, alive: p.alive, bombsPlaced: p.bombsPlaced, dir: p.dirChoice, bomb: p.bombRequest })),
    enemies: m.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y })),
    bombs: m.bombs.map((b) => ({ x: b.x, y: b.y, fuse: b.fuse, owner: b.owner })),
    explosions: m.explosions,
    events: m.events,
    over: m.over,
    result: m.result,
  };
}

/** 对外的整体视图（两边都可以看） */
export function publicView(c) {
  return {
    phase: c.phase,
    codingUsedMs: c.codingUsedMs,
    codingLeftMs: Math.max(0, CODING_MS - c.codingUsedMs),
    paused: c.paused,
    pauseCount: c.pauseCount,
    consent: c.consent,
    codeErrors: c.codeErrors,
    series: { rounds: c.series.rounds, wins: c.series.wins, over: c.series.over, winner: c.series.winner },
    round: c.round ? snapshot(c.round) : null,
    results: c.results,
  };
}
