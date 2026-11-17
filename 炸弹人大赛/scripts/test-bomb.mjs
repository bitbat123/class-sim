// 炸弹人大赛的核心测试：解释器、规则、赛制、暂停、同意开始、录像。
import { BASELINES } from '../shared/baselines.js';
import { checkCode } from '../shared/interp.js';
import { createMatch, step, loadScript, runScriptFrame, newSeries, recordRound, ROUND_TURN_CAP } from '../shared/game.js';
import {
  createContest, setCode, setPaused, tickCoding, setConsent, playTurn, PHASE, CODING_MS, publicView,
} from '../shared/match.js';

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

// ---- 1. 解释器：语法与只读 ----
check('基准程序语法正确（最弱/中等/最强）',
  ['weak', 'medium', 'strong'].every((k) => checkCode(BASELINES[k].src).length === 0));
check('禁止 iostream', checkCode('#include<iostream>\nvoid main(){}').length > 0);
check('缺少 #include<bomb.h> 报错', checkCode('void main(){}').length > 0);
{
  const m = createMatch(0);
  const r = runScriptFrame(m, 0, loadScript('#include<bomb.h>\nvoid main(){ bomb::enemy_pos = 1; }'));
  check('只读变量不能修改', !r.ok && /只读/.test(r.error), JSON.stringify(r));
}
{
  const m = createMatch(0);
  const r = runScriptFrame(m, 0, loadScript('#include<bomb.h>\nvoid main(){ while(true){} }'));
  check('死循环被步数限制拦住', !r.ok, JSON.stringify(r));
}
{
  const m = createMatch(0);
  const r = runScriptFrame(m, 0, loadScript('#include<bomb.h>\nvoid main(){ bomb::player_dir = 1; bomb::player_bomb = true; }'));
  check('两个可写变量可以写入', r.ok && m.players[0].dirChoice === 1 && m.players[0].bombRequest === true);
}

// ---- 2. 规则：先死者输 ----
{
  const m = createMatch(0);
  // 把玩家 2 直接放到玩家 1 的炸弹爆炸范围内，用受控状态验证“先死者输”
  m.players[0].x = 1; m.players[0].y = 1;
  m.players[1].x = 2; m.players[1].y = 1;
  m.bombs.push({ x: 1, y: 1, fuse: 1, owner: 0 });
  step(m);
  check('先死者输：只剩一人时存活者胜', m.over && m.result === 'player2', `result=${m.result}`);
}

// ---- 3. 时间到：放炸弹少者胜 ----
{
  const m = createMatch(0);
  m.players[0].bombsPlaced = 3;
  m.players[1].bombsPlaced = 1;
  m.turn = ROUND_TURN_CAP - 1;
  step(m);
  check('2 分钟时间到：放炸弹少的一方赢', m.over && m.result === 'player2', `result=${m.result}`);
}
{
  const m = createMatch(0);
  m.players[0].bombsPlaced = 2;
  m.players[1].bombsPlaced = 2;
  m.turn = ROUND_TURN_CAP - 1;
  step(m);
  check('时间到且放炸弹数相同：平局', m.over && m.result === 'draw', `result=${m.result}`);
}

// ---- 4. 三局两胜 ----
{
  const s = newSeries();
  recordRound(s, 'player1');
  recordRound(s, 'player2');
  check('三局两胜：未决出前不结束', !s.over);
  recordRound(s, 'player1');
  check('三局两胜：一方先赢两局即整场结束', s.over && s.winner === 'player1', JSON.stringify(s));
}
{
  const s = newSeries();
  recordRound(s, 'player1');
  recordRound(s, 'player1');
  check('两局即可提前结束（2:0）', s.over && s.winner === 'player1' && s.rounds.length === 2);
}

// ---- 5. 编写 20 分钟：暂停时时间不走 ----
{
  const c = createContest({ mapOrder: [0, 1, 2] });
  tickCoding(c, 5 * 60 * 1000);
  setPaused(c, true);
  tickCoding(c, 60 * 60 * 1000);   // 暂停期间不应计时
  check('暂停时编写时间不走', c.codingUsedMs === 5 * 60 * 1000, `used=${c.codingUsedMs}`);
  setPaused(c, false);
  tickCoding(c, CODING_MS);
  check('编写满 20 分钟后进入“同意开始”阶段', c.phase === PHASE.CONSENT, `phase=${c.phase}`);
}

// ---- 6. 双方都同意后才开始 ----
{
  const c = createContest({ mapOrder: [0, 1, 2] });
  setCode(c, 'player1', BASELINES.weak.src);
  setCode(c, 'player2', BASELINES.medium.src);
  tickCoding(c, CODING_MS);
  setConsent(c, 'player1', true);
  check('只有一方同意时不开始', c.phase === PHASE.CONSENT);
  setConsent(c, 'player2', true);
  check('双方同意后开始第一局', c.phase === PHASE.PLAYING && c.series.rounds.length === 0);
}
{
  const c = createContest({ mapOrder: [0] });
  setCode(c, 'player1', 'void main(){}');   // 缺少 include
  tickCoding(c, CODING_MS);
  setConsent(c, 'player1', true);
  const r = setConsent(c, 'player2', true);
  check('代码有语法错误时不能开始', !r.ok && c.phase === PHASE.CONSENT, JSON.stringify(r));
}

// ---- 7. 整场：三局两胜，并生成录像 ----
{
  const c = createContest({ mapOrder: [0, 1, 2] });
  setCode(c, 'player1', BASELINES.medium.src);
  setCode(c, 'player2', BASELINES.weak.src);
  tickCoding(c, CODING_MS);
  setConsent(c, 'player1', true);
  setConsent(c, 'player2', true);
  let guard = 0;
  while (c.phase !== PHASE.FINISHED && guard++ < 2000) {
    if (c.phase === PHASE.PLAYING) playTurn(c);
    else if (c.phase === PHASE.CONSENT) { setConsent(c, 'player1', true); setConsent(c, 'player2', true); }
  }
  check('整场比赛能结束', c.phase === PHASE.FINISHED, `phase=${c.phase} guard=${guard}`);
  check('整场结束有胜者', c.series.over && ['player1', 'player2', 'draw'].includes(c.series.winner));
  check('录像包含开局和结束事件',
    c.replay.some((f) => f.type === 'round-start') && c.replay.some((f) => f.type === 'match-end'));
  check('对局视图只读可序列化', JSON.stringify(publicView(c)).length > 0);
}

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
