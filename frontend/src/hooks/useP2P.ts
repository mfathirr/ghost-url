import { useState, useEffect, useRef, useCallback } from 'react';
import type { PeerInfo, SignalMessage, IncomingTransfer, WSStatus, TransferPayload } from '../types/p2p';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function getWebSocketUrl(roomCode?: string): string {
  const envWs = import.meta.env.VITE_WS_URL;
  const envApi = import.meta.env.VITE_API_BASE_URL;
  let base: string;

  if (envWs && envWs.trim() !== '') {
    base = envWs.trim().replace(/\/+$/, '');
    // Support users passing https:// or http:// instead of wss:// or ws://
    if (base.startsWith('https://')) {
      base = 'wss://' + base.slice(8);
    } else if (base.startsWith('http://')) {
      base = 'ws://' + base.slice(7);
    }
    // If user provided wss://backend.railway.app without /ws/p2p
    if (!base.includes('/ws/p2p')) {
      base = `${base}/ws/p2p`;
    }
  } else if (envApi && envApi.trim().startsWith('http')) {
    // Automatically infer WebSocket URL from API URL!
    // e.g. https://ghost-backend.up.railway.app/api -> wss://ghost-backend.up.railway.app/ws/p2p
    try {
      const parsed = new URL(envApi.trim());
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      base = `${wsProto}//${parsed.host}/ws/p2p`;
    } catch {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      base = `${protocol}//${window.location.host}/ws/p2p`;
    }
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${protocol}//${window.location.host}/ws/p2p`;
  }

  // Always enforce wss:// if frontend is running over https:// to prevent mixed content errors
  if (window.location.protocol === 'https:' && base.startsWith('ws://')) {
    base = 'wss://' + base.slice(5);
  }

  if (roomCode && roomCode.trim() !== '') {
    const delimiter = base.includes('?') ? '&' : '?';
    return `${base}${delimiter}room=${encodeURIComponent(roomCode.trim())}`;
  }
  return base;
}

export function useP2P(initialRoomCode = '') {
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode);
  const [wsStatus, setWsStatus] = useState<WSStatus>('connecting');
  const [selfInfo, setSelfInfo] = useState<PeerInfo | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [incomingTransfer, setIncomingTransfer] = useState<IncomingTransfer | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const selfInfoRef = useRef<PeerInfo | null>(null);
  const isUnmountedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selfInfoRef.current = selfInfo;
  }, [selfInfo]);

  // Send raw message over WebSocket
  const sendSignal = useCallback((msg: SignalMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Set up data channel listeners
  const setupDataChannel = useCallback((peerId: string, dc: RTCDataChannel) => {
    dataChannels.current.set(peerId, dc);

    dc.onopen = () => {
      // Data channel open
    };

    dc.onclose = () => {
      dataChannels.current.delete(peerId);
    };

    dc.onerror = (err) => {
      console.warn(`[P2P] DataChannel error with peer ${peerId}:`, err);
    };

    dc.onmessage = (event) => {
      try {
        const data: TransferPayload = JSON.parse(event.data);
        setIncomingTransfer({
          senderId: peerId,
          senderName: data.senderName || 'Nearby Device',
          type: data.type || 'text',
          content: data.content || '',
          receivedAt: Date.now(),
        });
      } catch {
        // Fallback for plain text
        setIncomingTransfer({
          senderId: peerId,
          senderName: 'Nearby Device',
          type: 'text',
          content: String(event.data),
          receivedAt: Date.now(),
        });
      }
    };
  }, []);

  // Drain queued ICE candidates once remote description is set
  const drainCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current.get(peerId);
    if (queue && queue.length > 0) {
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[P2P] Error adding queued ICE candidate for ${peerId}:`, err);
        }
      }
      pendingCandidates.current.delete(peerId);
    }
  }, []);

  // Create or retrieve an existing RTCPeerConnection for a given peer
  const getOrCreatePeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    let pc = peerConnections.current.get(peerId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          targetId: peerId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        dataChannels.current.delete(peerId);
        peerConnections.current.delete(peerId);
      }
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(peerId, event.channel);
    };

    return pc;
  }, [sendSignal, setupDataChannel]);

  // Connect / Reconnect WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsStatus('connecting');

    const url = getWebSocketUrl(roomCode);
    console.info(`[P2P] Connecting to signaling server: ${url}`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error(`[P2P] Failed to construct WebSocket for ${url}:`, err);
      setWsStatus('error');
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      console.info(`[P2P] Connected to ${url}`);
      setWsStatus('connected');
    };

    ws.onerror = (err) => {
      console.error(`[P2P] WebSocket connection error on ${url}:`, err);
      setWsStatus('error');
    };

    ws.onclose = (event) => {
      console.warn(`[P2P] WebSocket closed (code=${event.code}, reason=${event.reason || 'none'}). Target was ${url}`);
      setWsStatus('disconnected');

      // Attempt auto-reconnect if component is still mounted
      if (!isUnmountedRef.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connectWebSocket();
          }
        }, 3500);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg: SignalMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'self-info': {
            const { self, room } = msg.payload;
            setSelfInfo(self);
            setCurrentRoom(room);
            break;
          }

          case 'peers-list': {
            const { peers: remotePeers } = msg.payload;
            setPeers(remotePeers || []);
            break;
          }

          case 'peer-joined': {
            const { peer: newPeer } = msg.payload;
            setPeers((prev) => {
              if (prev.some((p) => p.id === newPeer.id)) return prev;
              return [...prev, newPeer];
            });
            break;
          }

          case 'peer-left': {
            const { peerId } = msg.payload;
            setPeers((prev) => prev.filter((p) => p.id !== peerId));

            // Clean up connections
            const pc = peerConnections.current.get(peerId);
            if (pc) {
              pc.close();
              peerConnections.current.delete(peerId);
            }
            dataChannels.current.delete(peerId);
            pendingCandidates.current.delete(peerId);
            break;
          }

          case 'direct-transfer': {
            if (!msg.payload) return;
            const payload: TransferPayload = msg.payload;
            setIncomingTransfer({
              senderId: msg.from || '',
              senderName: payload.senderName || 'Nearby Device',
              type: payload.type || 'link',
              content: payload.content || '',
              receivedAt: Date.now(),
            });
            break;
          }

          case 'offer': {
            if (!msg.from || !msg.payload) return;
            const senderId = msg.from;
            const pc = getOrCreatePeerConnection(senderId);

            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            await drainCandidates(senderId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignal({
              type: 'answer',
              targetId: senderId,
              payload: answer,
            });
            break;
          }

          case 'answer': {
            if (!msg.from || !msg.payload) return;
            const senderId = msg.from;
            const pc = peerConnections.current.get(senderId);
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
              await drainCandidates(senderId, pc);
            }
            break;
          }

          case 'ice-candidate': {
            if (!msg.from || !msg.payload) return;
            const senderId = msg.from;
            const pc = peerConnections.current.get(senderId);

            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
              } catch (err) {
                console.warn('[P2P] Failed to add ICE candidate:', err);
              }
            } else {
              // Queue candidate until remote description is set
              const queue = pendingCandidates.current.get(senderId) || [];
              queue.push(msg.payload);
              pendingCandidates.current.set(senderId, queue);
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[P2P] WebSocket message processing error:', err);
      }
    };
  }, [roomCode, drainCandidates, getOrCreatePeerConnection, sendSignal]);

  // Connect on mount or when roomCode changes
  useEffect(() => {
    const pcs = peerConnections.current;
    const dcs = dataChannels.current;
    const candidates = pendingCandidates.current;

    isUnmountedRef.current = false;
    connectWebSocket();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      pcs.forEach((pc) => pc.close());
      pcs.clear();
      dcs.clear();
      candidates.clear();
    };
  }, [connectWebSocket]);

  // Send link or text to a selected peer (WebRTC with instant signaling fallback)
  const sendToPeer = useCallback(
    async (peerId: string, content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      const isUrl = /^https?:\/\//i.test(trimmed);
      const payload: TransferPayload = {
        type: isUrl ? 'link' : 'text',
        content: trimmed,
        senderName: selfInfoRef.current?.name || 'Nearby Device',
        timestamp: Date.now(),
      };
      const serialized = JSON.stringify(payload);

      // 1. If data channel is already open, send directly via WebRTC DataChannel
      const existingDc = dataChannels.current.get(peerId);
      if (existingDc && existingDc.readyState === 'open') {
        existingDc.send(serialized);
        return true;
      }

      // 2. Otherwise initiate WebRTC offer and set up timer fallback to signaling relay
      const pc = getOrCreatePeerConnection(peerId);
      const dc = pc.createDataChannel('ghost-transfer', { ordered: true });
      setupDataChannel(peerId, dc);

      return new Promise<boolean>((resolve) => {
        let resolved = false;

        // Fallback after 1.2s if WebRTC channel hasn't opened yet
        const timer = setTimeout(() => {
          if (!resolved) {
            sendSignal({
              type: 'direct-transfer',
              targetId: peerId,
              payload,
            });
            resolved = true;
            resolve(true);
          }
        }, 1200);

        dc.onopen = () => {
          if (!resolved) {
            clearTimeout(timer);
            dc.send(serialized);
            resolved = true;
            resolve(true);
          }
        };

        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({
              type: 'offer',
              targetId: peerId,
              payload: offer,
            });
          } catch (err) {
            if (!resolved) {
              clearTimeout(timer);
              sendSignal({
                type: 'direct-transfer',
                targetId: peerId,
                payload,
              });
              resolved = true;
              resolve(true);
            }
          }
        })();
      });
    },
    [getOrCreatePeerConnection, sendSignal, setupDataChannel]
  );

  const clearIncoming = useCallback(() => {
    setIncomingTransfer(null);
  }, []);

  return {
    roomCode,
    setRoomCode,
    wsStatus,
    selfInfo,
    currentRoom,
    peers,
    incomingTransfer,
    clearIncoming,
    sendToPeer,
    reconnect: connectWebSocket,
  };
}
