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

export interface TransferPayload {
  type: 'link' | 'text';
  content: string;
  senderName: string;
  timestamp: number;
}

export interface IncomingTransfer {
  senderId: string;
  senderName: string;
  type: 'link' | 'text';
  content: string;
  receivedAt: number;
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
