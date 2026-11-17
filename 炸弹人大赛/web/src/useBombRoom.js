import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_BOMB_WS || `ws://${location.hostname}:8790`;

/** 联机客户端：只发送意图，所有判定由服务端完成 */
export function useBombRoom() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(null);   // { room, player, mapOrder }
  const [view, setView] = useState(null);       // 服务端广播的对局视图
  const [frames, setFrames] = useState([]);     // 实时画面帧
  const [errors, setErrors] = useState(null);   // 代码检查错误
  const [logs, setLogs] = useState([]);
  const [replay, setReplay] = useState(null);
  const [error, setError] = useState(null);

  const pushLog = (text) => setLogs((l) => [...l.slice(-80), text]);

  const connect = useCallback((room, player) => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', room, player }));
    };
    ws.onclose = () => { setConnected(false); pushLog('与服务端断开'); };
    ws.onerror = () => setError('无法连接服务端，请确认服务端已启动');
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'joined') { setJoined(msg); pushLog(`已加入房间 ${msg.room}（${msg.player}）`); }
      if (msg.type === 'state') setView(msg.view);
      if (msg.type === 'turn') setFrames((f) => [...f, msg.frame]);
      if (msg.type === 'code-check') setErrors(msg.errors);
      if (msg.type === 'info') pushLog(msg.message);
      if (msg.type === 'error') { setError(msg.message); pushLog('错误：' + msg.message); }
      if (msg.type === 'replay') setReplay({ replay: msg.replay, results: msg.results });
      if (msg.type === 'round-end') pushLog('本局结束：' + JSON.stringify(msg.results.at(-1)));
    };
  }, []);

  const sendCode = useCallback((src) => {
    wsRef.current?.send(JSON.stringify({ type: 'code', src }));
  }, []);
  const consent = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'consent', agree: true }));
  }, []);
  const pause = useCallback(() => wsRef.current?.send(JSON.stringify({ type: 'pause' })), []);
  const resume = useCallback(() => wsRef.current?.send(JSON.stringify({ type: 'resume' })), []);
  const requestReplay = useCallback(() => wsRef.current?.send(JSON.stringify({ type: 'replay' })), []);

  useEffect(() => () => wsRef.current?.close(), []);

  return {
    connected, joined, view, frames, errors, logs, replay, error,
    connect, sendCode, consent, pause, resume, requestReplay, pushLog, WS_URL,
  };
}
