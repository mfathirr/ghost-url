package p2p

import "encoding/json"

// MessageType identifies the signaling or presence action.
type MessageType string

const (
	TypeSelfInfo     MessageType = "self-info"
	TypePeersList    MessageType = "peers-list"
	TypePeerJoined   MessageType = "peer-joined"
	TypePeerLeft     MessageType = "peer-left"
	TypeOffer        MessageType = "offer"
	TypeAnswer       MessageType = "answer"
	TypeICECandidate MessageType = "ice-candidate"
	TypePing         MessageType = "ping"
	TypePong         MessageType = "pong"
)

// PeerInfo describes a visible peer in the room.
type PeerInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	OS         string `json:"os"`
	DeviceType string `json:"deviceType"`
}

// SignalMessage represents messages exchanged over the WebSocket connection.
type SignalMessage struct {
	Type     MessageType     `json:"type"`
	From     string          `json:"from,omitempty"`
	TargetID string          `json:"targetId,omitempty"`
	Payload  json.RawMessage `json:"payload,omitempty"`
}

// SelfInfoPayload is sent to the client immediately upon connection.
type SelfInfoPayload struct {
	Self PeerInfo `json:"self"`
	Room string   `json:"room"`
}

// PeersListPayload contains the list of currently active peers in the room.
type PeersListPayload struct {
	Peers []PeerInfo `json:"peers"`
}

// PeerJoinedPayload announces a new peer to existing room members.
type PeerJoinedPayload struct {
	Peer PeerInfo `json:"peer"`
}

// PeerLeftPayload announces that a peer has disconnected.
type PeerLeftPayload struct {
	PeerID string `json:"peerId"`
}
