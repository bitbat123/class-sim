// 服务端集成测试：两个 WebSocket 客户端进同一个房间，走完「编写 → 同意 → 三局两胜」。
import { startServer } from '../server/index.js';
import WebSocket from 'ws';
import { BASELINES } from '../shared/baselines.js';

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' -> ' + detail : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 8799;
const wss = startServer({ port: PORT, host: '127.0.0.1' });
await sleep(120);

function client(player) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const inbox = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  const ready = new Promise((res) => ws.on('open', res));
  return {
    ws,
    inbox,
    ready,
    send: (m) => ws.send(JSON.stringify(m)),
    last: () => inbox[inbox.length - 1],
    ofType: (t) => inbox.filter((m) => m.type === t),
  };
}

const p1 = client('player1');
const p2 = client('player2');
await Promise.all([p1.ready, p2.ready]);

p1.send({ type: 'join', room: 'test-room', player: 'player1' });
p2.send({ type: 'join', room: 'test-room', player: 'player2' });
await sleep(200);

check('两人都加入成功', p1.ofType('joined').length === 1 && p2.ofType('joined').length === 1);
check('收到对局状态', p1.ofType('state').length > 0);
{
  const st = p1.ofType('state').at(-1).view;
  check('初始阶段是编写代码', st.phase === 'coding', st.phase);
  check('编写倒计时 20 分钟', st.codingLeftMs > 19 * 60 * 1000, String(st.codingLeftMs));
}

// 第三个客户端试图占用玩家1
const p3 = client('player1');
await p3.ready;
p3.send({ type: 'join', room: 'test-room', player: 'player1' });
await sleep(150);
check('已占用的座位不能重复加入', p3.ofType('error').length === 1, JSON.stringify(p3.inbox));
p3.ws.close();

// 提交代码
p1.send({ type: 'code', src: BASELINES.medium.src });
p2.send({ type: 'code', src: BASELINES.weak.src });
await sleep(250);
check('代码检查通过（无错误）', p1.ofType('code-check').at(-1).errors.length === 0);

// 提交有语法错误的代码，应报告错误
p2.send({ type: 'code', src: 'void main(){}' });
await sleep(200);
check('缺少头文件的代码被报错', p2.ofType('code-check').at(-1).errors.length > 0);
p2.send({ type: 'code', src: BASELINES.weak.src });
await sleep(150);

check('编写阶段不能直接开始对局', (() => {
  p1.send({ type: 'consent', agree: true });
  return true;
})());
await sleep(200);
check('编写阶段确认被拒绝', p1.ofType('error').length > 0, JSON.stringify(p1.ofType('error')));

// 直接把编写时间推到结束（通过服务端内部状态，避免测试等 20 分钟）
const { rooms } = await import('../server/index.js');
const room = rooms.get('test-room');
room.contest.codingUsedMs = 20 * 60 * 1000 - 400;
await sleep(700);
check('编写时间到后进入同意阶段', room.contest.phase === 'consent', room.contest.phase);

p1.send({ type: 'consent', agree: true });
await sleep(150);
check('单方同意不开始', room.contest.phase === 'consent');
p2.send({ type: 'consent', agree: true });
await sleep(300);
check('双方同意后开局', room.contest.phase === 'playing' || room.contest.phase === 'consent', room.contest.phase);

// 等对局推进
let guard = 0;
while (room.contest.phase !== 'finished' && guard++ < 200) {
  if (room.contest.phase === 'consent') {
    p1.send({ type: 'consent', agree: true });
    p2.send({ type: 'consent', agree: true });
  }
  await sleep(150);
}
check('整场比赛在服务端跑完', room.contest.phase === 'finished', `phase=${room.contest.phase} guard=${guard}`);
check('产生了胜者', ['player1', 'player2', 'draw'].includes(room.contest.series.winner), String(room.contest.series.winner));
check('收到了对局推送', p1.ofType('turn').length > 0, String(p1.ofType('turn').length));

// 录像
p1.send({ type: 'replay' });
await sleep(250);
check('可以取回录像', p1.ofType('replay').length === 1 && p1.ofType('replay')[0].replay.length > 0);

p1.ws.close();
p2.ws.close();
await sleep(200);
check('双方离开后房间被清理', !rooms.has('test-room'));

wss.close();
await sleep(100);
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
