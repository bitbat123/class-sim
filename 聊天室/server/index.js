// Shared chat room WebSocket server.
// State kept in memory only: connected users and the last HISTORY_LIMIT public messages.
// Private messages are delivered only to sender and recipient and are never stored.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 2000;
export const HISTORY_LIMIT = 200;

// C0 and C1 control characters (includes \t, \n, \r, \0, DEL, ...).
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

function codePointLength(str) {
  return [...str].length;
}

/** Returns { value } on success or { error } on failure. */
export function validateName(raw) {
  if (typeof raw !== 'string') return { error: '昵称必须是字符串。' };
  if (CONTROL_CHARS.test(raw)) return { error: '昵称不能包含控制字符。' };
  const name = raw.trim();
  const len = codePointLength(name);
  if (len < 1 || len > MAX_NAME_LENGTH) {
    return { error: `昵称长度必须为 1-${MAX_NAME_LENGTH} 个字符。` };
  }
  return { value: name };
}

/** Returns { value } on success or { error } on failure. */
export function validateText(raw) {
  if (typeof raw !== 'string') return { error: '消息内容必须是字符串。' };
  if (raw.trim().length === 0) return { error: '消息不能为空。' };
  if (codePointLength(raw) > MAX_MESSAGE_LENGTH) {
    return { error: `消息不能超过 ${MAX_MESSAGE_LENGTH} 个字符。` };
  }
  return { value: raw };
}

export function createChatServer({
  port = 0,
  host = '0.0.0.0',
  historyLimit = HISTORY_LIMIT,
} = {}) {
  const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Chat server. Connect with a WebSocket client.\n');
  });
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });

  /** @type {Map<import('ws').WebSocket, { name: string }>} */
  const clients = new Map();
  /** @type {Array<object>} public messages only */
  const history = [];
  let nextId = 1;

  const send = (ws, obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };
  const sendError = (ws, message) => send(ws, { type: 'error', message });
  const broadcast = (obj) => {
    for (const ws of clients.keys()) send(ws, obj);
  };
  const onlineNames = () => [...clients.values()].map((c) => c.name);
  const broadcastUsers = () => broadcast({ type: 'users', users: onlineNames() });

  const findByName = (name) => {
    const wanted = name.toLowerCase();
    for (const [ws, c] of clients) {
      if (c.name.toLowerCase() === wanted) return { ws, name: c.name };
    }
    return null;
  };

  function handleJoin(ws, msg) {
    if (clients.has(ws)) return sendError(ws, '你已经加入聊天室。');
    const v = validateName(msg.name);
    if (v.error) return sendError(ws, v.error);
    if (findByName(v.value)) return sendError(ws, '该昵称已在线，请换一个。');

    clients.set(ws, { name: v.value });
    send(ws, { type: 'welcome', name: v.value, users: onlineNames(), history: [...history] });
    broadcastUsers();
  }

  function handlePublic(ws, msg, client) {
    const v = validateText(msg.text);
    if (v.error) return sendError(ws, v.error);
    const out = {
      type: 'public',
      id: nextId++,
      from: client.name,
      text: v.value,
      ts: Date.now(),
    };
    history.push(out);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
    broadcast(out);
  }

  function handlePrivate(ws, msg, client) {
    if (typeof msg.to !== 'string') return sendError(ws, '缺少私聊对象。');
    const v = validateText(msg.text);
    if (v.error) return sendError(ws, v.error);
    const target = findByName(msg.to.trim());
    if (!target) return sendError(ws, '对方不在线。');
    if (target.ws === ws) return sendError(ws, '不能给自己发私聊消息。');
    const out = {
      type: 'private',
      id: nextId++,
      from: client.name,
      to: target.name,
      text: v.value,
      ts: Date.now(),
    };
    // Only sender and recipient receive this. Not added to history.
    send(ws, out);
    send(target.ws, out);
  }

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return sendError(ws, '消息格式错误（需要 JSON）。');
      }
      if (!msg || typeof msg !== 'object') return sendError(ws, '消息格式错误。');

      if (msg.type === 'join') return handleJoin(ws, msg);

      const client = clients.get(ws);
      if (!client) return sendError(ws, '请先设置昵称加入聊天室。');

      switch (msg.type) {
        case 'public':
          return handlePublic(ws, msg, client);
        case 'private':
          return handlePrivate(ws, msg, client);
        default:
          return sendError(ws, `未知消息类型：${String(msg.type)}`);
      }
    });

    ws.on('close', () => {
      if (clients.delete(ws)) broadcastUsers();
    });
    ws.on('error', () => {
      // Errors on a single socket must not crash the server; 'close' follows.
    });
  });

  const listening = new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject);
      resolve(httpServer.address());
    });
  });

  return {
    ready: listening,
    get port() {
      const addr = httpServer.address();
      return addr && typeof addr === 'object' ? addr.port : port;
    },
    close() {
      return new Promise((resolve) => {
        for (const ws of clients.keys()) ws.terminate();
        clients.clear();
        wss.close(() => httpServer.close(() => resolve()));
      });
    },
  };
}

// Run directly: `node index.js`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '0.0.0.0';
  const server = createChatServer({ port, host });
  server.ready
    .then((addr) => {
      console.log(`chat server listening on ${host}:${addr.port} (ws path: any, e.g. /ws)`);
    })
    .catch((err) => {
      console.error('failed to start chat server:', err.message);
      process.exit(1);
    });
}
