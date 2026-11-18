import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL =
  import.meta.env.VITE_WS_URL || `ws://${window.location.hostname || '127.0.0.1'}:8080`;

/**
 * Owns the WebSocket connection and chat state.
 * Public messages go to `publicMessages`; private messages go to `privateMessages[peer]`,
 * where `peer` is the other participant's name. The server only sends a private message
 * to its sender and recipient, so the client never sees other private traffic.
 */
export function useChat() {
  const [status, setStatus] = useState('idle'); // idle | connecting | open | closed
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [publicMessages, setPublicMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({});
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const meRef = useRef(null);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'welcome':
        setMe(msg.name);
        meRef.current = msg.name;
        setUsers(msg.users);
        setPublicMessages(msg.history);
        setError(null);
        break;
      case 'users':
        setUsers(msg.users);
        break;
      case 'public':
        setPublicMessages((prev) => [...prev, msg].slice(-200));
        break;
      case 'private': {
        const peer = msg.from === meRef.current ? msg.to : msg.from;
        setPrivateMessages((prev) => ({
          ...prev,
          [peer]: [...(prev[peer] || []), msg],
        }));
        break;
      }
      case 'error':
        setError(msg.message);
        break;
      default:
        break;
    }
  }, []);

  const connect = useCallback(
    (name) => {
      setError(null);
      setStatus('connecting');
      // Close any previous socket (e.g. after a rejected name) so retries don't leak connections.
      const previous = wsRef.current;
      wsRef.current = null;
      if (previous) previous.close();
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus('open');
        ws.send(JSON.stringify({ type: 'join', name }));
      };
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        handleMessage(msg);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          setStatus('closed');
          setMe(null);
          meRef.current = null;
          setUsers([]);
        }
      };
      ws.onerror = () => setError('无法连接到聊天服务器。');
    },
    [handleMessage],
  );

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) ws.close();
    setStatus('idle');
    setMe(null);
    meRef.current = null;
  }, []);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('尚未连接到聊天服务器。');
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  useEffect(() => () => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) ws.close();
  }, []);

  return {
    status,
    me,
    users,
    publicMessages,
    privateMessages,
    error,
    setError,
    connect,
    disconnect,
    send,
  };
}
