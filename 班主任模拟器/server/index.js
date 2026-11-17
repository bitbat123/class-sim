// ============ 联机服务端（WebSocket，依赖 ws 包） ============
// 每个房间最多 2 名玩家，每人控制一个班级。服务端持有每位玩家的权威游戏状态：
//   - 客户端只发送「意图」{ type, ...参数 }，不发送结算结果；
//   - 服务端先用 validateIntent 校验（学生 ID、科目、班费、行动次数等），
//     再用与前端完全相同的 gameReducer 结算，并把新状态广播给房间内所有人；
//   - 随机种子由服务端生成（客户端无法指定），保证结算可信。
//
// 消息协议（JSON）：
//   客户端 → 服务端
//     { type: 'join', room: '房间号', name: '昵称' }
//     { type: 'intent', intent: { type: 'START' | 'STUDY' | 'RELIEF' | 'TREAT' | 'END_WEEK' | 'DISMISS_EVENT' | 'RESET', ... } }
//   服务端 → 客户端
//     { type: 'room', room, you: 0|1, players: [{ slot, name, connected, state }] }
//     { type: 'error', message }
import { randomInt } from 'node:crypto';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { gameReducer, validateIntent } from '../src/engine.js';

export const MAX_PLAYERS = 2;
const ROOM_RE = /^[\w\u4e00-\u9fa5-]{1,16}$/;
const NAME_MAX = 12;
const newSeed = () => randomInt(0, 2 ** 32);

const cleanName = (n) => (typeof n === 'string' ? n.trim().slice(0, NAME_MAX) : '');

/** 把客户端意图转换为 reducer 动作；随机种子在服务端生成 */
function buildAction(intent) {
  switch (intent.type) {
    case 'START':
      return {
        type: 'START',
        payload: {
          system: intent.system,
          difficulty: intent.difficulty,
          mode: intent.mode,
          x: intent.x,
          names: intent.names.map((n) => n.trim()),
          seed: newSeed(),
        },
      };
    case 'STUDY':
      return { type: 'STUDY', actionId: intent.actionId, students: intent.students, subjects: intent.subjects, seed: newSeed() };
    case 'RELIEF':
      return { type: 'RELIEF', actionId: intent.actionId, students: intent.students };
    case 'TREAT':
      return { type: 'TREAT', students: intent.students };
    case 'END_WEEK':
      return { type: 'END_WEEK', seed: newSeed() };
    case 'DISMISS_EVENT':
      return { type: 'DISMISS_EVENT' };
    case 'RESET':
      return { type: 'RESET' };
    default:
      return null;
  }
}

/**
 * 创建联机服务。返回 { port, rooms, close }。
 * port 传 0 时由系统分配端口（测试用），实际端口见返回值。
 */
export async function createGameServer({ port = 8787, host = 'localhost' } = {}) {
  const rooms = new Map(); // code -> { code, slots: [{ ws, name, state }, ...] }
  const wss = new WebSocketServer({ port, host, maxPayload: 64 * 1024 });
  await once(wss, 'listening');
  const { port: actualPort } = wss.address();

  const send = (ws, msg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const sendError = (ws, message) => send(ws, { type: 'error', message });

  function broadcast(room) {
    const players = room.slots.map((s, j) => ({ slot: j, name: s.name, connected: !!s.ws, state: s.state }));
    room.slots.forEach((s, i) => {
      if (s.ws) send(s.ws, { type: 'room', room: room.code, you: i, players });
    });
  }

  function handleJoin(ws, msg) {
    if (ws.room) return sendError(ws, '已经在房间中');
    const code = String(msg.room ?? '').trim();
    if (!ROOM_RE.test(code)) return sendError(ws, '房间号须为 1~16 位字母、数字、汉字、下划线或短横线');
    let room = rooms.get(code);
    if (!room) {
      room = { code, slots: Array.from({ length: MAX_PLAYERS }, () => ({ ws: null, name: '', state: null })) };
      rooms.set(code, room);
    }
    const idx = room.slots.findIndex((s) => !s.ws);
    if (idx < 0) return sendError(ws, `房间已满（最多 ${MAX_PLAYERS} 人）`);
    const slot = room.slots[idx];
    slot.ws = ws;
    slot.name = cleanName(msg.name) || `玩家${idx + 1}`;
    ws.room = room;
    ws.slot = idx;
    broadcast(room);
  }

  function handleIntent(ws, intent) {
    const room = ws.room;
    if (!room) return sendError(ws, '请先加入房间');
    const slot = room.slots[ws.slot];
    // 1) 先校验：不合法的意图直接拒绝，不改变状态
    const err = validateIntent(slot.state, intent);
    if (err) return sendError(ws, err);
    // 2) 再用同一个 reducer 结算
    const action = buildAction(intent);
    const next = action ? gameReducer(slot.state, action) : slot.state;
    if (next === slot.state) return sendError(ws, '操作未生效');
    slot.state = next;
    broadcast(room);
  }

  wss.on('connection', (ws) => {
    ws.room = null;
    ws.slot = -1;
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return sendError(ws, '消息不是合法的 JSON');
      }
      if (!msg || typeof msg !== 'object') return sendError(ws, '消息格式错误');
      if (msg.type === 'join') return handleJoin(ws, msg);
      if (msg.type === 'intent') return handleIntent(ws, msg.intent);
      return sendError(ws, `未知消息类型：${msg.type}`);
    });
    ws.on('close', () => {
      const room = ws.room;
      if (!room) return;
      room.slots[ws.slot].ws = null;
      if (room.slots.every((s) => !s.ws)) rooms.delete(room.code);
      else broadcast(room);
    });
  });

  return {
    port: actualPort,
    rooms,
    close: () =>
      new Promise((resolve) => {
        for (const c of wss.clients) c.terminate();
        wss.close(() => resolve());
      }),
  };
}

// 直接运行 `node server/index.js` 时启动服务
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || 'localhost';
  const srv = await createGameServer({ port, host });
  console.log(`[联机服务] 已启动：ws://${host}:${srv.port}（按 Ctrl+C 停止）`);
}
