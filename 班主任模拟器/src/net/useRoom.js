// 联机客户端：只负责连接房间、发送「意图」、接收服务端广播的权威状态。
// 客户端不做任何结算——所有状态都来自服务端（服务端用同一个 engine.js 的 reducer 结算）。
import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE = { status: 'idle', error: null, room: null, you: -1, players: [] };

/** 默认服务端地址：可通过 VITE_GAME_SERVER_URL 覆盖（见 README），不写死任何正式域名 */
export const DEFAULT_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || 'ws://localhost:8787';

export function useRoom() {
  const wsRef = useRef(null);
  const [conn, setConn] = useState(IDLE);

  const close = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      ws.close();
    }
  }, []);

  const connect = useCallback(
    (url, room, name) => {
      close();
      setConn({ ...IDLE, status: 'connecting', room });
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        setConn({ ...IDLE, status: 'error', error: `无法连接服务器：${e.message}` });
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room, name }));
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === 'room') {
          setConn({ status: 'joined', error: null, room: msg.room, you: msg.you, players: msg.players });
        } else if (msg.type === 'error') {
          // 加入阶段的错误（如房间已满）会让连接失效；操作阶段的错误只提示
          setConn((c) => (c.status === 'joined' ? { ...c, error: msg.message } : { ...IDLE, status: 'error', error: msg.message }));
        }
      };
      ws.onerror = () => setConn((c) => ({ ...c, status: 'error', error: `无法连接 ${url}，请确认服务端已启动` }));
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setConn((c) => (c.status === 'joined' || c.status === 'connecting' ? { ...c, status: 'closed' } : c));
      };
    },
    [close],
  );

  /** 发送意图（不附带任何结算结果） */
  const send = useCallback((intent) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setConn((c) => ({ ...c, error: '未连接到房间' }));
      return false;
    }
    ws.send(JSON.stringify({ type: 'intent', intent }));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    close();
    setConn(IDLE);
  }, [close]);

  useEffect(() => close, [close]);

  return { ...conn, connect, send, disconnect, online: conn.status === 'joined' };
}
