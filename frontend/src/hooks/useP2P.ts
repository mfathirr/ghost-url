import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  PeerInfo,
  SignalMessage,
  IncomingTransfer,
  WSStatus,
  TransferPayload,
  FileOfferPayload,
  FileTransferProgress,
} from '../types/p2p';

const CHUNK_SIZE = 16384; // 16 KB chunks for stable WebRTC throughput across all devices

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 0,
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
    // If user copied API URL containing /api or /api/, strip it
    base = base.replace(/\/api\/?$/, '');
    // If user provided host without /ws/p2p
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

export function inferMimeType(fileName: string, mimeType?: string): string {
  if (mimeType && mimeType !== 'application/octet-stream' && mimeType.trim() !== '') {
    return mimeType;
  }
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.zip')) return 'application/zip';
  return mimeType || 'application/octet-stream';
}

interface ReceivingSession {
  transferId: string;
  currentBatch: ArrayBuffer[];
  blobParts: Blob[];
  receivedChunks: number;
  totalChunks: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  senderName: string;
}

export function useP2P(initialRoomCode = '') {

  const [roomCode, setRoomCode] = useState<string>(() => {
    if (initialRoomCode) return initialRoomCode;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const qRoom = searchParams.get('room');
      if (qRoom) return qRoom;
      const hash = window.location.hash;
      const match = hash.match(/room=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return '';
  });
  const [wsStatus, setWsStatus] = useState<WSStatus>('connecting');
  const [selfInfo, setSelfInfo] = useState<PeerInfo | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [incomingTransfer, setIncomingTransfer] = useState<IncomingTransfer | null>(null);
  const [outgoingProgress, setOutgoingProgress] = useState<FileTransferProgress | null>(null);
  const [incomingProgress, setIncomingProgress] = useState<FileTransferProgress | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingDataChannels = useRef<Map<string, Promise<RTCDataChannel>>>(new Map());
  const selfInfoRef = useRef<PeerInfo | null>(null);
  const peersRef = useRef<PeerInfo[]>([]);
  const isUnmountedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const currentConnectingUrlRef = useRef<string>('');

  // File transfer coordination refs
  const pendingFileSends = useRef<
    Map<string, { file: File; peerId: string; resolve: (val: boolean) => void }>
  >(new Map());
  const receivingTransferByPeer = useRef<Map<string, ReceivingSession>>(new Map());


  useEffect(() => {
    selfInfoRef.current = selfInfo;
  }, [selfInfo]);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  // Send raw message over WebSocket
  const sendSignal = useCallback((msg: SignalMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  // Stream file chunks over direct WebSocket signaling relay (failsafe when WebRTC DataChannel is blocked)
  const streamFileChunksRelay = useCallback(
    async (
      file: File,
      transferId: string,
      peerId: string,
      resolve: (val: boolean) => void
    ) => {
      try {
        console.info(`[P2P] Streaming file "${file.name}" (${file.size} bytes) via Signaling Relay to peer ${peerId}`);
        const peer = peersRef.current.find((p) => p.id === peerId);
        const peerName = peer?.name || 'Nearby Device';
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let offset = 0;
        let chunkIndex = 0;

        while (offset < file.size) {
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();

          // Convert ArrayBuffer to base64
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          const chunkPayload: TransferPayload = {
            type: 'file-chunk',
            transferId,
            senderName: selfInfoRef.current?.name || 'Nearby Device',
            timestamp: Date.now(),
            fileChunk: {
              transferId,
              chunkIndex,
              totalChunks,
              data: base64Data,
            },
          };

          sendSignal({
            type: 'direct-transfer',
            targetId: peerId,
            payload: chunkPayload,
          });

          offset += CHUNK_SIZE;
          chunkIndex++;

          // Yield and check WebSocket outgoing buffer backpressure
          while (wsRef.current && wsRef.current.bufferedAmount > 64 * 1024) {
            await new Promise((r) => setTimeout(r, 15));
          }
          await new Promise((r) => setTimeout(r, 4));

          if (totalChunks < 20 || chunkIndex % 4 === 0 || chunkIndex === totalChunks) {
            const pct = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));
            setOutgoingProgress({
              transferId,
              peerId,
              peerName,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type || 'application/octet-stream',
              chunksTransferred: chunkIndex,
              totalChunks,
              percentage: pct,
              direction: 'sending',
            });
          }
        }

        // Send completion marker
        const donePayload: TransferPayload = {
          type: 'file-done',
          transferId,
          senderName: selfInfoRef.current?.name || 'Nearby Device',
          timestamp: Date.now(),
        };
        sendSignal({
          type: 'direct-transfer',
          targetId: peerId,
          payload: donePayload,
        });

        setTimeout(() => {
          setOutgoingProgress(null);
          pendingFileSends.current.delete(transferId);
          resolve(true);
        }, 1200);
      } catch (err) {
        console.error('[P2P] Error in relay file streaming:', err);
        setOutgoingProgress(null);
        pendingFileSends.current.delete(transferId);
        resolve(false);
      }
    },
    [sendSignal]
  );

  // Stream binary file chunks over WebRTC DataChannel with backpressure
  const streamFileChunksDC = useCallback(
    async (
      dc: RTCDataChannel,
      file: File,
      transferId: string,
      peerId: string,
      resolve: (val: boolean) => void
    ) => {
      try {
        console.info(`[P2P] Streaming file "${file.name}" (${file.size} bytes) via WebRTC DataChannel to peer ${peerId}`);
        const peer = peersRef.current.find((p) => p.id === peerId);
        const peerName = peer?.name || 'Nearby Device';
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let offset = 0;
        let chunkIndex = 0;

        while (offset < file.size) {
          if (dc.readyState !== 'open') {
            console.warn('[P2P] DataChannel closed during file streaming, falling back to relay');
            return streamFileChunksRelay(file, transferId, peerId, resolve);
          }

          // Backpressure check: wait if WebRTC outgoing buffer exceeds 128KB
          while (dc.bufferedAmount > 128 * 1024) {
            await new Promise((r) => setTimeout(r, 15));
            if (dc.readyState !== 'open') break;
          }

          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();
          dc.send(buffer);

          offset += CHUNK_SIZE;
          chunkIndex++;
          await new Promise((r) => setTimeout(r, 2));

          // Throttle state updates
          if (totalChunks < 20 || chunkIndex % 4 === 0 || chunkIndex === totalChunks) {
            const pct = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));
            setOutgoingProgress({
              transferId,
              peerId,
              peerName,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type || 'application/octet-stream',
              chunksTransferred: chunkIndex,
              totalChunks,
              percentage: pct,
              direction: 'sending',
            });
          }
        }

        // Send completion marker frame
        if (dc.readyState === 'open') {
          const donePayload: TransferPayload = {
            type: 'file-done',
            transferId,
            senderName: selfInfoRef.current?.name || 'Nearby Device',
            timestamp: Date.now(),
          };
          dc.send(JSON.stringify(donePayload));
        }

        setTimeout(() => {
          setOutgoingProgress(null);
          pendingFileSends.current.delete(transferId);
          resolve(true);
        }, 1200);
      } catch (err) {
        console.error('[P2P] Error streaming file chunks via DC:', err);
        setOutgoingProgress(null);
        pendingFileSends.current.delete(transferId);
        resolve(false);
      }
    },
    [streamFileChunksRelay]
  );

  // References to break circular dependency cycles
  const ensureDataChannelRef = useRef<(peerId: string, timeoutMs?: number) => Promise<RTCDataChannel>>(null!);
  const getOrCreatePeerConnectionRef = useRef<(peerId: string) => RTCPeerConnection>(null!);
  const handleIncomingPayloadRef = useRef<(senderId: string, data: TransferPayload, dc?: RTCDataChannel) => void>(null!);
  const drainCandidatesRef = useRef<(peerId: string, pc: RTCPeerConnection) => Promise<void>>(null!);
  const sendSignalRef = useRef<(msg: SignalMessage) => void>(null!);

  // Finalize receiving: converts batches to a single Blob, cleans memory, and handles platform download
  const finalizeFileReceive = useCallback((peerId: string, rx: ReceivingSession) => {
    if (!receivingTransferByPeer.current.has(peerId)) return;
    receivingTransferByPeer.current.delete(peerId);

    // Flush any pending chunks in the active batch into blobParts
    if (rx.currentBatch.length > 0) {
      rx.blobParts.push(new Blob(rx.currentBatch));
      rx.currentBatch = [];
    }
    const blobParts = rx.blobParts;
    rx.blobParts = [];
    const effectiveType = inferMimeType(rx.fileName, rx.fileType);

    try {
      const blob = new Blob(blobParts, {
        type: effectiveType,
      });
      blobParts.length = 0;
      const downloadUrl = URL.createObjectURL(blob);

      const isIOS =
        typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

      if (isIOS) {
        setIncomingProgress(null);
        setIncomingTransfer({
          senderId: peerId,
          senderName: rx.senderName,
          type: 'file-offer',
          content: rx.fileName,
          receivedAt: Date.now(),
          completedDownload: {
            url: downloadUrl,
            fileName: rx.fileName,
            fileSize: rx.fileSize,
            fileType: effectiveType,
            blob,
          },
        });
      } else {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = rx.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
        setTimeout(() => {
          setIncomingProgress(null);
          setIncomingTransfer(null);
        }, 1200);
      }
    } catch (err) {
      console.error('[P2P] Failed to assemble or trigger download for file:', err);
      setIncomingProgress(null);
      setIncomingTransfer(null);
    }
  }, []);

  // Unified handler for all incoming transfer control and content payloads (via DC or WebSocket)
  const handleIncomingPayload = useCallback(
    (senderId: string, data: TransferPayload, dc?: RTCDataChannel): void => {
      switch (data.type) {
        case 'file-offer': {
          console.info(`[P2P] Received file-offer from ${senderId}:`, data.fileOffer?.fileName);
          setIncomingTransfer({
            senderId,
            senderName: data.senderName || 'Nearby Device',
            type: 'file-offer',
            content: data.fileOffer?.fileName || 'Incoming file',
            receivedAt: Date.now(),
            fileOffer: data.fileOffer,
          });
          // Pre-warm peer connection so DataChannel is connecting in background
          if (getOrCreatePeerConnectionRef.current) {
            getOrCreatePeerConnectionRef.current(senderId);
          }
          break;
        }

        case 'file-accept': {
          const transferId = data.transferId || '';
          const pending = pendingFileSends.current.get(transferId);
          if (pending) {
            (async () => {
              try {
                let targetDc: RTCDataChannel | null = dc || null;
                if (!targetDc || targetDc.readyState !== 'open') {
                  targetDc = await ensureDataChannelRef.current(senderId, 2500);
                }
                if (targetDc && targetDc.readyState === 'open') {
                  targetDc.binaryType = 'arraybuffer';
                  streamFileChunksDC(targetDc, pending.file, transferId, pending.peerId, pending.resolve);
                } else {
                  streamFileChunksRelay(pending.file, transferId, pending.peerId, pending.resolve);
                }
              } catch (err) {
                console.warn('[P2P] DataChannel failed for file send, falling back to relay:', err);
                streamFileChunksRelay(pending.file, transferId, pending.peerId, pending.resolve);
              }
            })();
          }
          break;
        }

        case 'file-reject': {
          const transferId = data.transferId || '';
          const pending = pendingFileSends.current.get(transferId);
          if (pending) {
            pending.resolve(false);
            pendingFileSends.current.delete(transferId);
            setOutgoingProgress(null);
          }
          break;
        }

        case 'file-chunk': {
          if (!data.fileChunk) return;
          const { data: base64Data } = data.fileChunk;
          const rx = receivingTransferByPeer.current.get(senderId);
          if (!rx) {
            console.warn('[P2P] Received relay file chunk with no active receiving session for peer', senderId);
            return;
          }

          // Decode base64 to ArrayBuffer
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          rx.currentBatch.push(bytes.buffer);
          rx.receivedChunks++;

          // Flush batch into intermediate Blob every 64 chunks (~1 MB) to prevent heap exhaustion on iOS
          if (rx.currentBatch.length >= 64) {
            rx.blobParts.push(new Blob(rx.currentBatch));
            rx.currentBatch = [];
          }

          const pct = Math.min(100, Math.round((rx.receivedChunks / rx.totalChunks) * 100));

          if (rx.totalChunks < 20 || rx.receivedChunks % 4 === 0 || rx.receivedChunks === rx.totalChunks) {
            setIncomingProgress({
              transferId: rx.transferId,
              peerId: senderId,
              peerName: rx.senderName,
              fileName: rx.fileName,
              fileSize: rx.fileSize,
              fileType: rx.fileType,
              chunksTransferred: rx.receivedChunks,
              totalChunks: rx.totalChunks,
              percentage: pct,
              direction: 'receiving',
            });
          }

          if (rx.receivedChunks >= rx.totalChunks) {
            finalizeFileReceive(senderId, rx);
          }
          break;
        }

        case 'file-done': {
          const rx = receivingTransferByPeer.current.get(senderId);
          if (rx && (rx.blobParts.length > 0 || rx.currentBatch.length > 0)) {
            finalizeFileReceive(senderId, rx);
          }
          break;
        }

        default: {
          setIncomingTransfer({
            senderId,
            senderName: data.senderName || 'Nearby Device',
            type: data.type || 'text',
            content: data.content || '',
            receivedAt: Date.now(),
          });
          break;
        }
      }
    },
    [streamFileChunksDC, streamFileChunksRelay]
  );

  useEffect(() => {
    handleIncomingPayloadRef.current = handleIncomingPayload;
  }, [handleIncomingPayload]);

  // Set up data channel listeners
  const setupDataChannel = useCallback((peerId: string, dc: RTCDataChannel): void => {
    dataChannels.current.set(peerId, dc);
    try {
      dc.binaryType = 'arraybuffer';
    } catch (e) {
      console.warn('[P2P] Failed to set binaryType to arraybuffer:', e);
    }

    dc.onopen = () => {
      console.info(`[P2P] DataChannel with ${peerId} is OPEN!`);
      dataChannels.current.set(peerId, dc);
    };

    dc.onclose = () => {
      console.info(`[P2P] DataChannel with ${peerId} closed`);
      dataChannels.current.delete(peerId);
      receivingTransferByPeer.current.delete(peerId);
    };

    dc.onerror = (err) => {
      console.warn(`[P2P] DataChannel error with peer ${peerId}:`, err);
    };

    let messageQueue: Promise<void> = Promise.resolve();

    dc.onmessage = (event) => {
      messageQueue = messageQueue.then(async () => {
        const raw = event.data;
        const isString = typeof raw === 'string';

        // 1. Binary chunk handling (supports ArrayBuffer, Blob, and typed arrays)
        if (!isString) {
          let buffer: ArrayBuffer;
          try {
            if (raw instanceof ArrayBuffer) {
              buffer = raw;
            } else if (typeof Blob !== 'undefined' && raw instanceof Blob) {
              buffer = await raw.arrayBuffer();
            } else if (raw && typeof raw === 'object' && raw.buffer instanceof ArrayBuffer) {
              const byteOffset = raw.byteOffset || 0;
              const byteLength = raw.byteLength !== undefined ? raw.byteLength : raw.buffer.byteLength;
              buffer =
                byteOffset === 0 && byteLength === raw.buffer.byteLength
                  ? raw.buffer
                  : raw.buffer.slice(byteOffset, byteOffset + byteLength);
            } else {
              console.warn('[P2P] Received unknown binary chunk format:', raw);
              return;
            }
          } catch (err) {
            console.error('[P2P] Error converting binary chunk to ArrayBuffer:', err);
            return;
          }

          const rx = receivingTransferByPeer.current.get(peerId);
          if (!rx) {
            console.warn('[P2P] Received binary chunk with no active receiving session for peer', peerId);
            return;
          }

          rx.currentBatch.push(buffer);
          rx.receivedChunks++;

          // Flush batch into intermediate Blob every 64 chunks (~1 MB) to prevent heap exhaustion on iOS
          if (rx.currentBatch.length >= 64) {
            rx.blobParts.push(new Blob(rx.currentBatch));
            rx.currentBatch = [];
          }

          const pct = Math.min(100, Math.round((rx.receivedChunks / rx.totalChunks) * 100));

          if (rx.totalChunks < 20 || rx.receivedChunks % 4 === 0 || rx.receivedChunks === rx.totalChunks) {
            setIncomingProgress({
              transferId: rx.transferId,
              peerId,
              peerName: rx.senderName,
              fileName: rx.fileName,
              fileSize: rx.fileSize,
              fileType: rx.fileType,
              chunksTransferred: rx.receivedChunks,
              totalChunks: rx.totalChunks,
              percentage: pct,
              direction: 'receiving',
            });
          }

          if (rx.receivedChunks >= rx.totalChunks) {
            finalizeFileReceive(peerId, rx);
          }
          return;
        }

        // 2. JSON control / payload frames
        try {
          const data: TransferPayload = JSON.parse(raw);
          if (handleIncomingPayloadRef.current) {
            handleIncomingPayloadRef.current(peerId, data, dc);
          }
        } catch {
          // Fallback for plain text
          setIncomingTransfer({
            senderId: peerId,
            senderName: peersRef.current.find((p) => p.id === peerId)?.name || 'Nearby Device',
            type: 'text',
            content: raw,
            receivedAt: Date.now(),
          });
        }
      });
    };
  }, [finalizeFileReceive]);

  // Drain queued ICE candidates once remote description is set
  const drainCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidates.current.get(peerId);
    if (queue && queue.length > 0) {
      for (const candidate of queue) {
        if (!candidate || !candidate.candidate || candidate.candidate.trim() === '') continue;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[P2P] Error adding queued ICE candidate for ${peerId}:`, err);
        }
      }
      pendingCandidates.current.delete(peerId);
    }
  }, []);

  useEffect(() => {
    drainCandidatesRef.current = drainCandidates;
  }, [drainCandidates]);

  // Create or retrieve an existing RTCPeerConnection for a given peer
  const getOrCreatePeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    let pc = peerConnections.current.get(peerId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && event.candidate.candidate.trim() !== '') {
        sendSignal({
          type: 'ice-candidate',
          targetId: peerId,
          payload: event.candidate.toJSON ? event.candidate.toJSON() : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment,
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.info(`[P2P] ICE state with ${peerId}: ${pc.iceConnectionState}`);
    };

    pc.onicegatheringstatechange = () => {
      console.info(`[P2P] ICE gathering state with ${peerId}: ${pc.iceGatheringState}`);
    };

    pc.onconnectionstatechange = () => {
      console.info(`[P2P] Connection state with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        dataChannels.current.delete(peerId);
        peerConnections.current.delete(peerId);
        pendingDataChannels.current.delete(peerId);
      }
    };

    pc.ondatachannel = (event) => {
      console.info(`[P2P] Received remote DataChannel "${event.channel.label}" from peer ${peerId}, readyState=${event.channel.readyState}`);
      const channel = event.channel;
      try {
        channel.binaryType = 'arraybuffer';
      } catch (e) {}
      setupDataChannel(peerId, channel);
    };

    return pc;
  }, [sendSignal, setupDataChannel]);

  useEffect(() => {
    getOrCreatePeerConnectionRef.current = getOrCreatePeerConnection;
  }, [getOrCreatePeerConnection]);

  // Connect / Reconnect WebSocket
  const connectWebSocket = useCallback(() => {
    const url = getWebSocketUrl(roomCode);

    // If already connected or connecting to the exact same URL, avoid redundant reconnect
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) &&
      currentConnectingUrlRef.current === url
    ) {
      return;
    }

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    currentConnectingUrlRef.current = url;
    setWsStatus('connecting');
    setPeers([]);

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

      const wasIntentional = intentionalCloseRef.current;
      intentionalCloseRef.current = false;

      // Only attempt auto-reconnect if close was unexpected and component is still mounted
      if (!wasIntentional && !isUnmountedRef.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connectWebSocket();
          }
        }, 3500);
      }
    };

    ws.onmessage = async (event) => {
      const rawData = String(event.data);
      const lines = rawData.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg: SignalMessage = JSON.parse(line);
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
              if (handleIncomingPayloadRef.current) {
                handleIncomingPayloadRef.current(msg.from || '', msg.payload);
              }
              break;
            }

            case 'offer': {
              if (!msg.from || !msg.payload) return;
              const senderId = msg.from;
              if (!getOrCreatePeerConnectionRef.current) return;
              const pc = getOrCreatePeerConnectionRef.current(senderId);

              // Polite peer collision handling
              const isPolite = selfInfoRef.current?.id ? selfInfoRef.current.id < senderId : true;
              const hasCollision = pc.signalingState !== 'stable';

              if (hasCollision) {
                if (!isPolite) {
                  console.warn(`[P2P] Offer collision with ${senderId}, impolite peer ignoring offer`);
                  return;
                }
                console.info(`[P2P] Offer collision with ${senderId}, polite peer rolling back local offer`);
                try {
                  await pc.setLocalDescription({ type: 'rollback' });
                } catch (e) {
                  console.warn('[P2P] Rollback error:', e);
                }
              }

              try {
                console.info(`[P2P] Handling offer from ${senderId}`);
                await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                if (drainCandidatesRef.current) {
                  await drainCandidatesRef.current(senderId, pc);
                }

                if (sendSignalRef.current) {
                  sendSignalRef.current({
                    type: 'answer',
                    targetId: senderId,
                    payload: answer,
                  });
                }
                console.info(`[P2P] Sent answer to ${senderId}`);
              } catch (err) {
                console.error('[P2P] Error handling remote offer:', err);
              }
              break;
            }

            case 'answer': {
              if (!msg.from || !msg.payload) return;
              const senderId = msg.from;
              const pc = peerConnections.current.get(senderId);
              console.info(`[P2P] Received answer from ${senderId}, pc signalingState=${pc?.signalingState}`);
              if (pc && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer')) {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
                  if (drainCandidatesRef.current) {
                    await drainCandidatesRef.current(senderId, pc);
                  }
                  console.info(`[P2P] Remote answer set successfully for ${senderId}`);
                } catch (err) {
                  console.error('[P2P] Error handling remote answer:', err);
                }
              }
              break;
            }

            case 'ice-candidate': {
              if (!msg.from || !msg.payload) return;
              const senderId = msg.from;
              const candidateData = msg.payload;
              if (!candidateData || !candidateData.candidate || candidateData.candidate.trim() === '') {
                return;
              }
              const pc = peerConnections.current.get(senderId);

              if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidateData));
                } catch (err) {
                  console.warn('[P2P] Failed to add ICE candidate:', err);
                }
              } else {
                // Queue candidate until remote description is set
                const queue = pendingCandidates.current.get(senderId) || [];
                queue.push(candidateData);
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
      }
    };
  }, [roomCode]);

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
        intentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }
      currentConnectingUrlRef.current = '';
      pcs.forEach((pc) => pc.close());
      pcs.clear();
      dcs.clear();
      candidates.clear();
      pendingDataChannels.current.clear();
      pendingFileSends.current.forEach((item) => item.resolve(false));
      pendingFileSends.current.clear();
      receivingTransferByPeer.current.clear();
    };
  }, [roomCode, connectWebSocket]);

  // Ensure WebRTC DataChannel is ready (deduplicated promise)
  const ensureDataChannel = useCallback(
    (peerId: string, timeoutMs = 2500): Promise<RTCDataChannel> => {
      const existing = dataChannels.current.get(peerId);
      if (existing && existing.readyState === 'open') {
        return Promise.resolve(existing);
      }

      const pending = pendingDataChannels.current.get(peerId);
      if (pending) {
        return pending;
      }

      const pc = getOrCreatePeerConnection(peerId);

      // If we already have a connecting channel, wait for it to open WITHOUT creating a duplicate offer
      if (existing && existing.readyState === 'connecting') {
        const promise = new Promise<RTCDataChannel>((resolve, reject) => {
          let done = false;
          const timeout = setTimeout(() => {
            if (!done) {
              done = true;
              pendingDataChannels.current.delete(peerId);
              reject(new Error(`WebRTC DataChannel connection timed out after ${timeoutMs}ms`));
            }
          }, timeoutMs);

          const onOpen = () => {
            if (!done) {
              done = true;
              clearTimeout(timeout);
              pendingDataChannels.current.delete(peerId);
              resolve(existing);
            }
          };

          const onError = (e: any) => {
            if (!done) {
              done = true;
              clearTimeout(timeout);
              pendingDataChannels.current.delete(peerId);
              reject(e);
            }
          };

          existing.addEventListener('open', onOpen, { once: true });
          existing.addEventListener('error', onError, { once: true });
          if (existing.readyState === 'open') {
            onOpen();
          }
        });

        pendingDataChannels.current.set(peerId, promise);
        return promise;
      }

      // Otherwise create a fresh DataChannel and initiate negotiation
      const dc = pc.createDataChannel('ghost-transfer', { ordered: true });
      setupDataChannel(peerId, dc);

      const promise = new Promise<RTCDataChannel>((resolve, reject) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (!done) {
            done = true;
            pendingDataChannels.current.delete(peerId);
            reject(new Error(`WebRTC DataChannel connection timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        const onOpen = () => {
          if (!done) {
            done = true;
            clearTimeout(timeout);
            pendingDataChannels.current.delete(peerId);
            resolve(dc);
          }
        };

        const onError = (e: any) => {
          if (!done) {
            done = true;
            clearTimeout(timeout);
            pendingDataChannels.current.delete(peerId);
            reject(e);
          }
        };

        dc.addEventListener('open', onOpen, { once: true });
        dc.addEventListener('error', onError, { once: true });
        if (dc.readyState === 'open') {
          onOpen();
        }

        (async () => {
          try {
            if (pc.signalingState === 'stable') {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendSignal({
                type: 'offer',
                targetId: peerId,
                payload: offer,
              });
            }
          } catch (err) {
            if (!done) {
              done = true;
              clearTimeout(timeout);
              pendingDataChannels.current.delete(peerId);
              reject(err);
            }
          }
        })();
      });

      pendingDataChannels.current.set(peerId, promise);
      return promise;
    },
    [getOrCreatePeerConnection, sendSignal, setupDataChannel]
  );

  useEffect(() => {
    ensureDataChannelRef.current = ensureDataChannel;
  }, [ensureDataChannel]);

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

        dc.addEventListener(
          'open',
          () => {
            if (!resolved) {
              clearTimeout(timer);
              dc.send(serialized);
              resolved = true;
              resolve(true);
            }
          },
          { once: true }
        );

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

  // Send a file directly to a selected peer via WebRTC DataChannel
  const sendFileToPeer = useCallback(
    async (peerId: string, file: File): Promise<boolean> => {
      if (!file) return false;
      try {
        const transferId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `tx_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        const peer = peersRef.current.find((p) => p.id === peerId);
        const peerName = peer?.name || 'Nearby Device';

        const fileOffer: FileOfferPayload = {
          transferId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          totalChunks,
          senderName: selfInfoRef.current?.name || 'Nearby Device',
          timestamp: Date.now(),
        };

        setOutgoingProgress({
          transferId,
          peerId,
          peerName,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          chunksTransferred: 0,
          totalChunks,
          percentage: 0,
          direction: 'sending',
        });

        // Pre-warm DataChannel connection in background
        ensureDataChannel(peerId).catch((err) => {
          console.warn('[P2P] Background DataChannel pre-warm:', err);
        });

        return new Promise<boolean>((resolve) => {
          pendingFileSends.current.set(transferId, {
            file,
            peerId,
            resolve,
          });

          // Send file-offer frame over DataChannel (if open) AND via signaling relay for instant UI display
          const offerPayload: TransferPayload = {
            type: 'file-offer',
            senderName: selfInfoRef.current?.name || 'Nearby Device',
            timestamp: Date.now(),
            fileOffer,
          };

          const existingDc = dataChannels.current.get(peerId);
          if (existingDc && existingDc.readyState === 'open') {
            try {
              existingDc.send(JSON.stringify(offerPayload));
            } catch (err) {
              console.warn('[P2P] Error sending file offer on DC:', err);
            }
          }

          // Also dispatch via WebSocket signaling so receiver prompt appears immediately (<10ms)
          sendSignal({
            type: 'direct-transfer',
            targetId: peerId,
            payload: offerPayload,
          });
        });
      } catch (err) {
        console.error('[P2P] Failed to send file to peer:', err);
        setOutgoingProgress(null);
        return false;
      }
    },
    [ensureDataChannel, sendSignal]
  );

  // Receiver accepts incoming file offer
  const acceptIncomingFile = useCallback(() => {
    if (!incomingTransfer || incomingTransfer.type !== 'file-offer' || !incomingTransfer.fileOffer) {
      return;
    }
    const { fileOffer, senderId, senderName } = incomingTransfer;

    receivingTransferByPeer.current.set(senderId, {
      transferId: fileOffer.transferId,
      currentBatch: [],
      blobParts: [],
      receivedChunks: 0,
      totalChunks: fileOffer.totalChunks,
      fileName: fileOffer.fileName,
      fileType: fileOffer.fileType,
      fileSize: fileOffer.fileSize,
      senderName,
    });

    setIncomingProgress({
      transferId: fileOffer.transferId,
      peerId: senderId,
      peerName: senderName,
      fileName: fileOffer.fileName,
      fileSize: fileOffer.fileSize,
      fileType: fileOffer.fileType,
      chunksTransferred: 0,
      totalChunks: fileOffer.totalChunks,
      percentage: 0,
      direction: 'receiving',
    });

    const acceptPayload: TransferPayload = {
      type: 'file-accept',
      transferId: fileOffer.transferId,
      senderName: selfInfoRef.current?.name || 'Nearby Device',
      timestamp: Date.now(),
    };

    // 1. Try sending via WebRTC DataChannel
    const dc = dataChannels.current.get(senderId);
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(acceptPayload));
      } catch (err) {
        console.warn('[P2P] Failed to send accept via DC:', err);
      }
    }

    // 2. Also send via signaling relay
    sendSignal({
      type: 'direct-transfer',
      targetId: senderId,
      payload: acceptPayload,
    });
  }, [incomingTransfer, sendSignal]);

  // Receiver rejects incoming file offer
  const rejectIncomingFile = useCallback(() => {
    if (!incomingTransfer) return;
    if (incomingTransfer.completedDownload?.url) {
      try {
        URL.revokeObjectURL(incomingTransfer.completedDownload.url);
      } catch (err) {
        console.warn('[P2P] Error revoking object URL:', err);
      }
      setIncomingTransfer(null);
      setIncomingProgress(null);
      return;
    }
    if (incomingTransfer.type === 'file-offer' && incomingTransfer.fileOffer) {
      const rejectPayload: TransferPayload = {
        type: 'file-reject',
        transferId: incomingTransfer.fileOffer.transferId,
        senderName: selfInfoRef.current?.name || 'Nearby Device',
        timestamp: Date.now(),
      };
      const dc = dataChannels.current.get(incomingTransfer.senderId);
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(rejectPayload));
        } catch (err) {
          console.warn('[P2P] Failed to send reject via DC:', err);
        }
      }
      sendSignal({
        type: 'direct-transfer',
        targetId: incomingTransfer.senderId,
        payload: rejectPayload,
      });
    }
    setIncomingTransfer(null);
    setIncomingProgress(null);
  }, [incomingTransfer, sendSignal]);

  const clearIncoming = useCallback(() => {
    if (incomingTransfer?.completedDownload?.url) {
      try {
        URL.revokeObjectURL(incomingTransfer.completedDownload.url);
      } catch (err) {
        console.warn('[P2P] Error revoking object URL:', err);
      }
      setIncomingTransfer(null);
      return;
    }
    if (incomingTransfer && incomingTransfer.type === 'file-offer') {
      rejectIncomingFile();
    } else {
      setIncomingTransfer(null);
    }
  }, [incomingTransfer, rejectIncomingFile]);

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
    sendFileToPeer,
    acceptIncomingFile,
    rejectIncomingFile,
    outgoingProgress,
    incomingProgress,
    reconnect: connectWebSocket,
  };
}
