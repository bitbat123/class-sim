// 浏览器端本地对战：我和基准程序跑同一条赛道。
import { createRace, stepRace, runFrame, snapshot, raceDialect, MAX_TICKS } from '@shared/game.js';
import { BASELINES } from '@shared/baselines.js';

const { checkCode, parse, Interpreter } = raceDialect;

export const SPEED_MS = 24;   // 回放每帧间隔（越小越快）

export function runLocalRace(mySrc, oppSrc, seed = 7) {
  const errs = checkCode(mySrc);
  if (errs.length) return { frames: [], result: 'invalid', ticks: 0, error: errs[0].message };

  const race = createRace(seed);
  const mine = new Interpreter(parse(mySrc));
  const theirs = new Interpreter(parse(BASELINES[oppSrc].src));
  const frames = [{ type: 'start', snapshot: snapshot(race) }];

  let guard = 0;
  while (!race.over && guard++ < MAX_TICKS + 10) {
    runFrame(race, 0, mine);
    runFrame(race, 1, theirs);
    stepRace(race);
    // 每 2 帧录一帧，回放不至于太长
    if (race.tick % 2 === 0 || race.over) frames.push({ type: 'tick', snapshot: snapshot(race) });
  }
  const result = race.result === 'draw' ? 'draw' : (race.result === 'car1' ? 'me' : 'opponent');
  return { frames, result, ticks: race.tick, error: null };
}
