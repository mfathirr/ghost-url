export interface PeerInfo {
  id: string;
  name: string;
  os: string;
  deviceType: string;
}

export type SignalMessageType =
  | 'self-info'
  | 'peers-list'
  | 'peer-joined'
  | 'peer-left'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'direct-transfer'
  | 'ping'
  | 'pong';

export interface SignalMessage {
  type: SignalMessageType;
  from?: string;
  targetId?: string;
  payload?: any;
}

export type TransferType =
  | 'link'
  | 'text'
  | 'file-offer'
  | 'file-accept'
  | 'file-reject'
  | 'file-chunk'
  | 'file-done';

export interface FileChunkPayload {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // base64 encoded chunk
}

export interface FileOfferPayload {
  transferId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  senderName: string;
  timestamp: number;
}

export interface FileTransferProgress {
  transferId: string;
  peerId: string;
  peerName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunksTransferred: number;
  totalChunks: number;
  percentage: number;
  direction: 'sending' | 'receiving';
}

export interface TransferPayload {
  type: TransferType;
  content?: string;
  senderName: string;
  timestamp: number;
  fileOffer?: FileOfferPayload;
  fileChunk?: FileChunkPayload;
  transferId?: string;
}

export interface IncomingTransfer {
  senderId: string;
  senderName: string;
  type: TransferType;
  content: string;
  receivedAt: number;
  fileOffer?: FileOfferPayload;
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
