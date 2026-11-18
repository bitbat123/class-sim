// 赛车测试：方言、物理、出界、确定性、基准程序。
import {
  raceDialect, createRace, stepRace, runFrame, snapshot, buildTrack,
  MAX_TICKS, TRACK_LEN,
} from '../shared/game.js';
import { BASELINES } from '../shared/baselines.js';

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' -> ' + detail : '')); }
};
const { checkCode, parse, Interpreter } = raceDialect;

// 1. 方言
check('赛车头文件正确', checkCode('#include<car.h>\nvoid main(){}').length === 0);
check('禁止 go.h', checkCode('#include<go.h>\nvoid main(){}').length > 0);
check('三个基准语法正确', ['slow', 'mid', 'fast'].every((k) => checkCode(BASELINES[k].src).length === 0));
{
  const it = new Interpreter(parse('#include<car.h>\nvoid main(){ car::my_x = 1; }'));
  const race = createRace(1);
  const r = runFrame(race, 0, it);
  check('只读变量不能改', !r.ok && /只读/.test(r.error), JSON.stringify(r));
}
{
  const it = new Interpreter(parse('#include<car.h>\nvoid main(){ car::throttle = 500; car::steer = -500; }'));
  const race = createRace(1);
  runFrame(race, 0, it);
  check('写入会被夹紧到合法范围', race.cars[0].throttleInput === 100 && race.cars[0].steerInput === -100);
}

// 2. 赛道确定性
{
  const a = buildTrack(42);
  const b = buildTrack(42);
  const c = buildTrack(43);
  const same = [0, 0.25, 0.5, 0.75, 1].every((p) => a.centerAt(p) === b.centerAt(p));
  const diff = [0, 0.25, 0.5, 0.75, 1].some((p) => a.centerAt(p) !== c.centerAt(p));
  check('同种子跑道一致', same);
  check('不同种子跑道不同', diff);
}

// 3. 物理：油门前进
{
  const race = createRace(7);
  const it = new Interpreter(parse('#include<car.h>\nvoid main(){ car::throttle = 100; car::steer = 0; }'));
  const y0 = race.cars[0].y;
  for (let i = 0; i < 60; i++) { runFrame(race, 0, it); stepRace(race); }
  check('全油门会向前推进', race.cars[0].y > y0 + 10, `y ${y0} -> ${race.cars[0].y}`);
  check('速度有限制', race.cars[0].speed <= 26.01, `speed=${race.cars[0].speed}`);
}
{
  const race = createRace(7);
  const it = new Interpreter(parse('#include<car.h>\nvoid main(){ car::throttle = 0; }'));
  const y0 = race.cars[0].y;
  for (let i = 0; i < 60; i++) { runFrame(race, 0, it); stepRace(race); }
  check('不给油基本不动', Math.abs(race.cars[0].y - y0) < 1, `dy=${race.cars[0].y - y0}`);
}

// 4. 整局
function raceAll(a, b, seed = 11) {
  const race = createRace(seed);
  const ia = new Interpreter(parse(BASELINES[a].src));
  const ib = new Interpreter(parse(BASELINES[b].src));
  let guard = 0;
  while (!race.over && guard++ < MAX_TICKS + 10) {
    runFrame(race, 0, ia);
    runFrame(race, 1, ib);
    stepRace(race);
  }
  return race;
}
for (const [a, b] of [['slow', 'mid'], ['mid', 'fast'], ['fast', 'fast']]) {
  const r = raceAll(a, b);
  check(`${a} vs ${b} 能结束`, r.over, `tick=${r.tick} result=${r.result}`);
  console.log(`   ${a} vs ${b}: ${r.tick} 帧，进度 ${r.cars.map((c) => (c.progress * 100).toFixed(0) + '%').join(' / ')}，结果 ${r.result}`);
}

// 5. 快车比慢车快
{
  let fastWins = 0;
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
    const r = raceAll('fast', 'slow', seed);
    if (r.result === 'car1') fastWins++;
  }
  check('快基准多半赢慢基准', fastWins >= 6, `${fastWins}/8`);
}

// 6. 快照
{
  const r = raceAll('mid', 'fast');
  check('快照可 JSON 化', JSON.stringify(snapshot(r)).length > 200);
}

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
