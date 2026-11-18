// 浏览器端本地对战：我和基准程序下一局五子棋，并生成回放帧。
import { createGame, runTurn, snapshot, goDialect } from '@shared/game.js';
import { BASELINES } from '@shared/baselines.js';

const { checkCode, parse, Interpreter } = goDialect;

export const SPEED_MS = 220;

export function runLocalGame(mySrc, oppSrc, myColor = 'black') {
  const errs = checkCode(mySrc);
  if (errs.length) return { frames: [], result: 'invalid', moves: 0, error: errs[0].message };

  const g = createGame();
  const mine = new Interpreter(parse(mySrc));
  const theirs = new Interpreter(parse(BASELINES[oppSrc].src));
  const interpreters = myColor === 'black'
    ? { black: mine, white: theirs }
    : { black: theirs, white: mine };

  const frames = [{ type: 'start', snapshot: snapshot(g) }];
  let guard = 0;
  while (!g.over && guard++ < 240) {
    const r = runTurn(g, interpreters);
    frames.push({ type: 'move', snapshot: snapshot(g), error: r.error });
  }
  const me = myColor;               // 'black' | 'white'
  const result = g.result === 'draw' ? 'draw' : (g.result === me ? 'me' : 'opponent');
  return { frames, result, moves: g.turn, error: null };
}

export { goDialect, BASELINES };
