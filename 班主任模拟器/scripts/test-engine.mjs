// 运行方式：npm test   （即 node scripts/test-engine.mjs）
// 覆盖：时长模式增幅、reducer 确定性与纯净性、联机服务端拒绝非法意图 / 接受合法意图
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGame, gameReducer, validateIntent } from '../src/engine.js';
import { TIME_SCALE } from '../src/constants.js';
import { createGameServer } from '../server/index.js';

let passed = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    results.push(`PASS  ${name}`);
  } catch (e) {
    results.push(`FAIL  ${name}\n      ${e.message.split('\n').join('\n      ')}`);
    process.exitCode = 1;
  }
}

const NAMES = Array.from({ length: 10 }, (_, i) => `学生${i + 1}`);
const baseOpts = { system: '63', difficulty: 'normal', x: 10, names: NAMES };

/* ---------------- 1. 时长模式：同样的行动，越短的学程增幅越大 ---------------- */
await test('时长模式：完整 < 三年 < 一年（同一行动、同一种子的熟练度增幅）', async () => {
  const study = (mode) => {
    let s = createGame({ ...baseOpts, seed: 42, mode });
    s = gameReducer(s, {
      type: 'STUDY', actionId: 'tutor', students: [0, 1, 2], subjects: ['math'], seed: 7,
    });
    return s.students.slice(0, 3).reduce((a, st) => a + st.mastery.math, 0);
  };
  const full = study('full');
  const three = study('three');
  const one = study('one');
  assert.ok(full > 0, '完整模式应有增幅');
  assert.ok(three > full, `三年模式(${three.toFixed(2)}) 应高于完整模式(${full.toFixed(2)})`);
  assert.ok(one > three, `一年模式(${one.toFixed(2)}) 应高于三年模式(${three.toFixed(2)})`);
  // 熟练度从 0 开始，无收益递减与截断，增幅比例应严格等于时长倍率
  assert.ok(Math.abs(three / full - TIME_SCALE.three) < 1e-9, `三年/完整 比例应为 ${TIME_SCALE.three}`);
  assert.ok(Math.abs(one / full - TIME_SCALE.one) < 1e-9, `一年/完整 比例应为 ${TIME_SCALE.one}`);
  results.push(`      增幅：full=${full.toFixed(3)} three=${three.toFixed(3)} one=${one.toFixed(3)}`);
});

await test('时长模式：学年范围正确（完整 6 年 / 三年 3 年 / 一年 1 年）', async () => {
  const full = createGame({ ...baseOpts, seed: 1, mode: 'full' });
  const three = createGame({ ...baseOpts, seed: 1, mode: 'three' });
  const one = createGame({ ...baseOpts, seed: 1, mode: 'one' });
  assert.deepEqual(full.years, ['初一', '初二', '初三', '高一', '高二', '高三']);
  assert.deepEqual(three.years, ['高一', '高二', '高三']);
  assert.deepEqual(one.years, ['高三']);
  assert.equal(one.totalWeeks, 40);
  assert.equal(three.totalWeeks, 120);
});

/* ---------------- 2. 确定性与纯净性 ---------------- */
const scripted = (seed) => {
  let s = createGame({ ...baseOpts, seed, mode: 'three' });
  const ops = [
    { type: 'STUDY', actionId: 'quiz', students: [0, 1, 2, 3], subjects: ['chinese', 'math'], seed: 11 },
    { type: 'RELIEF', actionId: 'meeting', students: [4, 5] },
    { type: 'END_WEEK', seed: 12 },
    { type: 'STUDY', actionId: 'mock', students: [0, 1], subjects: ['english'], seed: 13 },
    { type: 'END_WEEK', seed: 14 },
    { type: 'END_WEEK', seed: 15 },
  ];
  for (const op of ops) s = gameReducer(s, op);
  return s;
};

await test('reducer 确定性：相同种子与动作序列得到完全相同的状态', async () => {
  assert.equal(JSON.stringify(scripted(2024)), JSON.stringify(scripted(2024)));
});

await test('reducer 确定性：不同开局种子会得到不同的班级', async () => {
  assert.notEqual(JSON.stringify(scripted(2024)), JSON.stringify(scripted(2025)));
});

await test('reducer 纯净：调用 reducer 不修改输入状态', async () => {
  const s0 = createGame({ ...baseOpts, seed: 9, mode: 'full' });
  const snap = JSON.stringify(s0);
  gameReducer(s0, { type: 'STUDY', actionId: 'exam', students: [0, 1], subjects: ['chinese', 'math', 'english'], seed: 3 });
  gameReducer(s0, { type: 'END_WEEK', seed: 4 });
  assert.equal(JSON.stringify(s0), snap, '输入状态被修改了');
});

/* ---------------- 3. 联机服务端 ---------------- */
function openClient(url) {
  const ws = new WebSocket(url);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw));
    const i = waiters.findIndex((w) => w.pred(msg));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else queue.push(msg);
  });
  const ready = new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const next = (pred, label = '消息', timeout = 3000) =>
    new Promise((resolve, reject) => {
      const idx = queue.findIndex(pred);
      if (idx >= 0) return resolve(queue.splice(idx, 1)[0]);
      const t = setTimeout(() => reject(new Error(`等待${label}超时`)), timeout);
      waiters.push({ pred, resolve: (m) => { clearTimeout(t); resolve(m); } });
    });
  return { ws, ready, next, send: (o) => ws.send(JSON.stringify(o)), close: () => ws.close() };
}

await test('联机：拒绝非法意图、接受合法意图（两名玩家各自独立）', async () => {
  const srv = await createGameServer({ port: 0, host: '127.0.0.1' });
  const url = `ws://127.0.0.1:${srv.port}`;
  const a = openClient(url);
  const b = openClient(url);
  try {
    await Promise.all([a.ready, b.ready]);
    const isRoom = (m) => m.type === 'room';
    const isErr = (m) => m.type === 'error';

    // 两人加入同一房间
    a.send({ type: 'join', room: 'test-room', name: '甲' });
    const roomA1 = await a.next((m) => isRoom(m) && m.players.length === 2 && m.players[0].connected, '房间广播');
    assert.equal(roomA1.you, 0, '第一个加入者应为 0 号位');
    b.send({ type: 'join', room: 'test-room', name: '乙' });
    const roomB1 = await b.next((m) => isRoom(m) && m.you === 1, '乙加入后的房间广播');
    assert.equal(roomB1.players[0].name, '甲');
    assert.equal(roomB1.players[1].name, '乙');

    // 非法意图 1：游戏未开始就学习
    a.send({ type: 'intent', intent: { type: 'STUDY', actionId: 'quiz', students: [0], subjects: ['math'] } });
    const e1 = await a.next(isErr, '未开始时的错误');
    assert.match(e1.message, /还没有开始/);

    // 非法意图 2：班级人数超过允许范围
    a.send({ type: 'intent', intent: { type: 'START', system: '63', difficulty: 'normal', mode: 'one', x: 0, names: [] } });
    const e2 = await a.next(isErr, '人数非法的错误');
    assert.match(e2.message, /人数/);

    // 合法意图：开局（服务端生成种子、校验姓名）
    const names = Array.from({ length: 8 }, (_, i) => `同学${i + 1}`);
    a.send({ type: 'intent', intent: { type: 'START', system: '63', difficulty: 'normal', mode: 'one', x: 8, names } });
    const roomA2 = await a.next((m) => isRoom(m) && m.players[0].state !== null, '开局后的房间广播');
    assert.equal(roomA2.players[0].state.students.length, 8);
    assert.deepEqual(roomA2.players[0].state.years, ['高三'], '一年模式应只有高三');
    assert.equal(roomA2.players[1].state, null, '乙的班级不应受甲影响');

    // 非法意图 3：学生 ID 不存在
    a.send({ type: 'intent', intent: { type: 'STUDY', actionId: 'quiz', students: [99], subjects: ['math'] } });
    const e3 = await a.next(isErr, '无效学生的错误');
    assert.match(e3.message, /学生/);

    // 非法意图 4：不存在的行动
    a.send({ type: 'intent', intent: { type: 'STUDY', actionId: 'no-such-action', students: [0], subjects: ['math'] } });
    const e4 = await a.next(isErr, '无效行动的错误');
    assert.match(e4.message, /学习行动无效/);

    // 合法意图：学习一次（班费扣除 10 = homework 10 × 1人 × 1科）
    const before = roomA2.players[0].state.budget;
    a.send({ type: 'intent', intent: { type: 'STUDY', actionId: 'homework', students: [0], subjects: ['math'] } });
    const roomA3 = await a.next((m) => isRoom(m) && m.players[0].state && m.players[0].state.actionsLeft === 2, '学习后的广播');
    assert.equal(roomA3.players[0].state.budget, before - 10, '服务端应按 reducer 扣除班费');
    assert.equal(roomA3.players[0].state.log.at(-1).type, 'action', '单人学习后最后一条日志应为 action');

    // 乙的状态仍不变（仍为 null）
    b.send({ type: 'intent', intent: { type: 'STUDY', actionId: 'homework', students: [0], subjects: ['math'] } });
    const e5 = await b.next(isErr, '乙未开局时的错误');
    assert.match(e5.message, /还没有开始/);

    results.push(`      服务端拒绝 4 条非法意图（未开始 / 人数 / 学生ID / 行动ID）；接受开局与学习；乙方状态保持隔离`);
  } finally {
    a.close();
    b.close();
    await srv.close();
  }
});

await test('联机：validateIntent 直接校验（无需网络）', async () => {
  const s = createGame({ ...baseOpts, seed: 5, mode: 'full' });
  assert.equal(validateIntent(s, { type: 'STUDY', actionId: 'quiz', students: [0], subjects: ['math'] }), null);
  assert.match(validateIntent(s, { type: 'STUDY', actionId: 'quiz', students: [], subjects: ['math'] }), /学生/);
  assert.match(validateIntent(s, { type: 'STUDY', actionId: 'quiz', students: [0], subjects: ['bogus'] }), /科目/);
  assert.match(validateIntent(null, { type: 'END_WEEK' }), /还没有开始/);
});

console.log('\n=== scripts/test-engine.mjs ===');
console.log(results.join('\n'));
console.log(`\n${passed} 项通过 / ${results.filter((r) => r.startsWith('FAIL')).length} 项失败`);
// 测试结束：强制退出，避免 ws 句柄残留
process.exit(process.exitCode ?? 0);
