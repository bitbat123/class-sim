// 五子棋测试：方言、规则、五连判定、违规判负、基准程序对局。
import { goDialect, createGame, place, runTurn, snapshot, findFive, BLACK, WHITE, EMPTY, SIZE } from '../shared/game.js';
import { BASELINES } from '../shared/baselines.js';

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' -> ' + detail : '')); }
};
const { checkCode, parse, Interpreter } = goDialect;

// 1. 方言
check('三方言前缀正确', checkCode('#include<go.h>\nvoid main(){}').length === 0);
check('禁止 iostream', checkCode('#include<iostream>\nvoid main(){}').length > 0);
check('禁止 bomb.h', checkCode('#include<bomb.h>\nvoid main(){}').length > 0);
check('三个基准程序语法正确', ['easy', 'mid', 'hard'].every((k) => checkCode(BASELINES[k].src).length === 0));

// 2. 规则：横竖斜五连
function dropLine(g, coords, color) {
  for (const [x, y] of coords) place(g, color, x, y);
}
{
  const g = createGame();
  for (let i = 0; i < 4; i++) { place(g, BLACK, i, 0); place(g, WHITE, i, 1); }
  const r = place(g, BLACK, 4, 0);
  check('横向五连获胜', r.over && r.result === 'black' && r.winnerLine.length >= 5);
}
{
  const g = createGame();
  for (let i = 0; i < 4; i++) { place(g, WHITE, 0, i); place(g, BLACK, 1, i); }
  const r = place(g, WHITE, 0, 4);
  check('纵向五连获胜', r.over && r.result === 'white');
}
{
  const g = createGame();
  for (let i = 0; i < 4; i++) { place(g, BLACK, i, i); place(g, WHITE, i, 10); }
  const r = place(g, BLACK, 4, 4);
  check('斜向五连获胜', r.over && r.result === 'black');
}
{
  const g = createGame();
  check('空棋盘无五连', findFive(g.board, 0, 0) === null);
}

// 3. 违规：重复落子
{
  const g = createGame();
  place(g, BLACK, 7, 7);
  place(g, WHITE, 7, 7);   // 重复
  check('重复落子记违规', g.illegal.white === 1 && g.turn === 1);
}
{
  const g = createGame();
  place(g, BLACK, 7, 7);
  for (let i = 0; i < 3; i++) place(g, WHITE, 7, 7);
  check('违规三次判负', g.over && g.result === 'black', `result=${g.result}`);
}

// 4. 互交白卷：满盘平局
{
  const g = createGame();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // 交替填满，不刻意连五（用颜色交替减少五连概率；只测试 turn 上限）
      g.board[y][x] = ((x + y) % 2 === 0) ? BLACK : WHITE;
      g.turn++;
    }
  }
  g.turn = 225;
  g.over = true;
  g.result = 'draw';
  check('满盘平局状态可表达', snapshot(g).result === 'draw');
}

// 5. 基准程序对局
function playBaseline(a, b, maxTurns = 225) {
  const g = createGame();
  const ib = new Interpreter(parse(BASELINES[a].src));
  const iw = new Interpreter(parse(BASELINES[b].src));
  let guard = 0;
  while (!g.over && guard++ < maxTurns) {
    runTurn(g, { black: ib, white: iw });
  }
  return g;
}
for (const [a, b] of [['easy', 'easy'], ['mid', 'easy'], ['hard', 'mid']]) {
  const g = playBaseline(a, b);
  check(`${a} vs ${b} 能正常结束`, g.over, `turns=${g.turn} result=${g.result}`);
  console.log(`   ${a} vs ${b}: ${g.turn} 手，结果 ${g.result}`);
}

// 6. 快照可序列化
{
  const g = playBaseline('mid', 'easy', 30);
  check('快照可 JSON 化', JSON.stringify(snapshot(g)).length > 100);
}

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
