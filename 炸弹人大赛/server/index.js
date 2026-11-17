// 炸弹人大赛服务端：一场比赛一个房间，两名玩家通过 WebSocket 连接。
// 服务端是唯一的裁判：代码检查、计时、暂停、同意开始、对局推进都在这里完成。
// 默认只监听本机（127.0.0.1）。需要局域网访问时设置 HOST=0.0.0.0。
import { WebSocketServer } from 'ws';
import {
  createContest, setCode, setPaused, tickCoding, setConsent, playTurn, publicView, PHASE,
} from '../shared/match.js';

const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '127.0.0.1';
const TICK_MS = 250;            // 计时器刻度（编写阶段）
const TURN_MS = 50;             // 每回合的间隔（对局推进速度，便于观看）
const MAX_CODE_CHARS = 20000;   // 单份代码上限，防止滥用

const rooms = new Map();          // roomId -> room
const socketInfo = new WeakMap(); // ws -> { roomId, player }

function shuffleMapOrder() {
  const idx = [...Array(10).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 3);
}

function makeRoom(id) {
  return {
    id,
    clients: { player1: null, player2: null },
    contest: createContest({ mapOrder: shuffleMapOrder() }),
    timer: null,
    turnTimer: null,
    lastTick: Date.now(),
  };
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  for (const p of ['player1', 'player2']) send(room.clients[p], msg);
}

function broadcastState(room) {
  broadcast(room, { type: 'state', view: publicView(room.contest) });
}

function startTicker(room) {
  if (room.timer) return;
  room.lastTick = Date.now();
  room.timer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - room.lastTick;
    room.lastTick = now;
    const c = room.contest;
    if (c.phase !== PHASE.CODING) return;
    const done = tickCoding(c, elapsed);
    if (done) broadcast(room, { type: 'info', message: '编写时间结束，请双方确认开始对局' });
    broadcastState(room);
  }, TICK_MS);
}

function stopLoops(room) {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
  if (room.turnTimer) { clearInterval(room.turnTimer); room.turnTimer = null; }
}

function startTurnLoop(room) {
  if (room.turnTimer) return;
  room.turnTimer = setInterval(() => {
    const c = room.contest;
    if (c.phase !== PHASE.PLAYING || c.paused) return;
    const frame = playTurn(c);
    if (!frame) return;
    broadcast(room, { type: 'turn', frame });
    if (c.phase !== PHASE.PLAYING) broadcast(room, { type: 'round-end', results: c.results });
    broadcastState(room);
    if (c.phase === PHASE.FINISHED) stopLoops(room);
  }, TURN_MS);
}

function leave(ws) {
  const info = socketInfo.get(ws);
  if (!info) return;
  const room = rooms.get(info.roomId);
  if (room && room.clients[info.player] === ws) room.clients[info.player] = null;
  socketInfo.delete(ws);
  if (room && !room.clients.player1 && !room.clients.player2) {
    stopLoops(room);
    rooms.delete(info.roomId);
  }
}

function handle(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return send(ws, { type: 'error', message: '消息格式错误' });
  }
  const info = socketInfo.get(ws);

  if (msg.type === 'join') {
    const roomId = String(msg.room || '').slice(0, 32);
    const player = msg.player === 'player2' ? 'player2' : 'player1';
    if (!roomId) return send(ws, { type: 'error', message: '请输入房间号' });
    let room = rooms.get(roomId);
    if (!room) { room = makeRoom(roomId); rooms.set(roomId, room); }
    if (room.clients[player] && room.clients[player] !== ws) {
      return send(ws, { type: 'error', message: `${player === 'player1' ? '玩家1' : '玩家2'} 已被占用` });
    }
    room.clients[player] = ws;
    socketInfo.set(ws, { roomId, player });
    send(ws, { type: 'joined', room: roomId, player, mapOrder: room.contest.mapOrder });
    startTicker(room);
    startTurnLoop(room);
    broadcastState(room);
    return;
  }

  if (!info) return send(ws, { type: 'error', message: '请先加入房间' });
  const room = rooms.get(info.roomId);
  const c = room.contest;

  switch (msg.type) {
    case 'code': {
      if (typeof msg.src !== 'string' || msg.src.length > MAX_CODE_CHARS) {
        return send(ws, { type: 'error', message: '代码过长或格式错误' });
      }
      const errors = setCode(c, info.player, msg.src);
      send(ws, { type: 'code-check', errors });
      broadcastState(room);
      return;
    }
    case 'pause':
      setPaused(c, true);
      broadcast(room, { type: 'info', message: `${info.player === 'player1' ? '玩家1' : '玩家2'} 暂停了比赛` });
      broadcastState(room);
      return;
    case 'resume':
      setPaused(c, false);
      broadcastState(room);
      return;
    case 'consent': {
      const r = setConsent(c, info.player, msg.agree === true);
      if (!r.ok) send(ws, { type: 'error', message: r.message });
      if (r.started) broadcast(room, { type: 'info', message: '双方已同意，本局开始' });
      broadcastState(room);
      return;
    }
    case 'replay':
      return send(ws, { type: 'replay', replay: c.replay, results: c.results });
    case 'rename-seat':
      // 允许断开后重新占用原座位
      return send(ws, { type: 'info', message: '座位已保持' });
    default:
      return send(ws, { type: 'error', message: '未知消息类型' });
  }
}

export function startServer({ port = PORT, host = HOST } = {}) {
  const wss = new WebSocketServer({ host, port, maxPayload: 256 * 1024 });
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => handle(ws, raw.toString()));
    ws.on('close', () => leave(ws));
    ws.on('error', () => leave(ws));
  });
  return wss;
}

// 直接运行时启动；被测试 import 时不自动监听
const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
  } catch {
    return false;
  }
})();
if (isMain) {
  startServer();
  console.log(`炸弹人大赛服务端已启动：ws://${HOST}:${PORT}`);
}

export { rooms, handle };
