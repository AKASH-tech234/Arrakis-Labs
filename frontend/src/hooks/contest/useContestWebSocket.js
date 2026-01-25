import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws/contest';

export function useContestWebSocket(contestId, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [serverTime, setServerTime] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const { onSubmissionResult, onContestStart, onContestEnd, token } = options;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;

        if (token) {
          wsRef.current.send(JSON.stringify({
            type: 'authenticate',
            payload: { token }
          }));
        }

        if (contestId) {
          wsRef.current.send(JSON.stringify({
            type: 'join_contest',
            payload: { contestId }
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code);
        setIsConnected(false);

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
    }
  }, [contestId, token]);

  const handleMessage = useCallback((message) => {
    const { type, ...data } = message;

    switch (type) {
      case 'connected':
      case 'authenticated':
        
        break;

      case 'joined_contest':
        setParticipantCount(data.participantCount || 0);
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
        break;

      case 'participant_count':
        setParticipantCount(data.count);
        break;

      case 'leaderboard_update':
      case 'leaderboard':
        if (data.entries) {
          setLeaderboard(data.entries);
        }
        setLastUpdate(Date.now());
        break;

      case 'submission_result':
        onSubmissionResult?.(data);
        break;

      case 'solve_notification':
        
        setLastUpdate(Date.now());
        break;

      case 'contest_started':
        setServerTime(data.serverTime);
        onContestStart?.(data);
        break;

      case 'contest_ended':
        onContestEnd?.(data);
        break;

      case 'announcement':
        setAnnouncements(prev => [
          { id: Date.now(), ...data },
          ...prev.slice(0, 9) 
        ]);
        break;

      case 'server_time':
        setServerTime(data.timestamp);
        break;

      case 'pong':
        
        break;

      default:
        console.log('[WS] Unknown message type:', type);
    }
  }, [onSubmissionResult, onContestStart, onContestEnd]);

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const refreshLeaderboard = useCallback((page = 1, pageSize = 50) => {
    send('get_leaderboard', { page, pageSize });
  }, [send]);

  const syncTime = useCallback(() => {
    send('get_time');
  }, [send]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (contestId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [contestId, connect, disconnect]);

  useEffect(() => {
    if (!isConnected) return;

    const heartbeat = setInterval(() => {
      send('ping');
    }, 25000);

    return () => clearInterval(heartbeat);
  }, [isConnected, send]);

  return {
    isConnected,
    leaderboard,
    participantCount,
    announcements,
    lastUpdate,
    serverTime,
    send,
    refreshLeaderboard,
    syncTime,
    disconnect,
    reconnect: connect,
  };
}

export default useContestWebSocket;
