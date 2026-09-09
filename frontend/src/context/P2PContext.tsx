import React, { createContext, useContext } from 'react';
import { useP2P } from '../hooks/useP2P';
import type { PeerInfo, IncomingTransfer, WSStatus, FileTransferProgress } from '../types/p2p';

export interface P2PContextType {
  roomCode: string;
  setRoomCode: (code: string) => void;
  wsStatus: WSStatus;
  selfInfo: PeerInfo | null;
  currentRoom: string;
  peers: PeerInfo[];
  incomingTransfer: IncomingTransfer | null;
  clearIncoming: () => void;
  sendToPeer: (peerId: string, content: string) => Promise<boolean>;
  sendFileToPeer: (peerId: string, file: File) => Promise<boolean>;
  acceptIncomingFile: () => void;
  rejectIncomingFile: () => void;
  outgoingProgress: FileTransferProgress | null;
  incomingProgress: FileTransferProgress | null;
  reconnect: () => void;
}

const P2PContext = createContext<P2PContextType | null>(null);

export const P2PProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const p2p = useP2P();
  return <P2PContext.Provider value={p2p}>{children}</P2PContext.Provider>;
};

export function useP2PContext(): P2PContextType {
  const context = useContext(P2PContext);
  if (!context) {
    throw new Error('useP2PContext must be used within a P2PProvider');
  }
  return context;
}
