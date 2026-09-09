package p2p

import (
	"encoding/json"
	"log"
	"sync"
)

// Hub maintains the set of active clients and handles routing WebRTC signaling messages.
type Hub struct {
	// rooms maps roomID -> clientID -> *Client
	rooms map[string]map[string]*Client
	mu    sync.RWMutex

	// Inbound register and unregister channels
	Register   chan *Client
	Unregister chan *Client
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

// Run executes the hub event loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)

		case client := <-h.Unregister:
			h.handleUnregister(client)
		}
	}
}

// handleRegister adds the client to its room and notifies peers.
func (h *Hub) handleRegister(client *Client) {
	h.mu.Lock()
	roomClients, exists := h.rooms[client.RoomID]
	if !exists {
		roomClients = make(map[string]*Client)
		h.rooms[client.RoomID] = roomClients
	}

	// Collect list of existing peers in the room
	existingPeers := make([]PeerInfo, 0, len(roomClients))
	for _, existing := range roomClients {
		existingPeers = append(existingPeers, existing.Info())
	}

	// Register current client
	roomClients[client.ID] = client
	h.mu.Unlock()

	log.Printf("[P2P] Client registered: ID=%s Name=%q Room=%s OS=%s Device=%s TotalPeers=%d",
		client.ID, client.Name, client.RoomID, client.OS, client.DeviceType, len(existingPeers)+1)

	// 1. Send SelfInfo to the newly connected client
	selfInfoPayload, _ := json.Marshal(SelfInfoPayload{
		Self: client.Info(),
		Room: client.RoomID,
	})
	selfMsg, _ := json.Marshal(SignalMessage{
		Type:    TypeSelfInfo,
		Payload: selfInfoPayload,
	})
	h.safeSend(client, selfMsg)

	// 2. Send PeersList to the newly connected client
	peersListPayload, _ := json.Marshal(PeersListPayload{
		Peers: existingPeers,
	})
	listMsg, _ := json.Marshal(SignalMessage{
		Type:    TypePeersList,
		Payload: peersListPayload,
	})
	h.safeSend(client, listMsg)

	// 3. Broadcast PeerJoined to all existing peers in the room
	joinedPayload, _ := json.Marshal(PeerJoinedPayload{
		Peer: client.Info(),
	})
	joinedMsg, _ := json.Marshal(SignalMessage{
		Type:    TypePeerJoined,
		Payload: joinedPayload,
	})

	h.mu.RLock()
	for id, otherClient := range roomClients {
		if id != client.ID {
			h.safeSend(otherClient, joinedMsg)
		}
	}
	h.mu.RUnlock()
}

// handleUnregister removes the client from its room and announces departure.
func (h *Hub) handleUnregister(client *Client) {
	h.mu.Lock()
	roomClients, exists := h.rooms[client.RoomID]
	if !exists {
		h.mu.Unlock()
		return
	}

	if _, ok := roomClients[client.ID]; !ok {
		h.mu.Unlock()
		return
	}

	delete(roomClients, client.ID)
	client.Close()

	empty := len(roomClients) == 0
	if empty {
		delete(h.rooms, client.RoomID)
	}
	h.mu.Unlock()

	log.Printf("[P2P] Client left: ID=%s Name=%q Room=%s RemainingPeers=%d",
		client.ID, client.Name, client.RoomID, len(roomClients))

	if !empty {
		// Broadcast PeerLeft to remaining peers in the room
		leftPayload, _ := json.Marshal(PeerLeftPayload{
			PeerID: client.ID,
		})
		leftMsg, _ := json.Marshal(SignalMessage{
			Type:    TypePeerLeft,
			Payload: leftPayload,
		})

		h.mu.RLock()
		if currentRoom, ok := h.rooms[client.RoomID]; ok {
			for _, remaining := range currentRoom {
				h.safeSend(remaining, leftMsg)
			}
		}
		h.mu.RUnlock()
	}
}

// RouteMessage forwards a signaling message to its specific target peer in the same room.
func (h *Hub) RouteMessage(sender *Client, msg SignalMessage) {
	if msg.Type == TypePing {
		pongMsg, _ := json.Marshal(SignalMessage{Type: TypePong})
		h.safeSend(sender, pongMsg)
		return
	}

	if msg.TargetID == "" {
		log.Printf("[P2P] Ignored message without targetId from %s (type=%s)", sender.ID, msg.Type)
		return
	}

	h.mu.RLock()
	roomClients, exists := h.rooms[sender.RoomID]
	if !exists {
		h.mu.RUnlock()
		return
	}

	targetClient, ok := roomClients[msg.TargetID]
	h.mu.RUnlock()

	if !ok {
		log.Printf("[P2P] Target peer %s not found in room %s", msg.TargetID, sender.RoomID)
		return
	}

	// Forward message to target
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[P2P] Failed to serialize signaling message: %v", err)
		return
	}

	h.safeSend(targetClient, data)
}

// safeSend attempts to write data to client send channel without blocking indefinitely.
func (h *Hub) safeSend(client *Client, data []byte) {
	defer func() {
		if r := recover(); r != nil {
			// Channel was closed
		}
	}()

	select {
	case client.Send <- data:
	default:
		log.Printf("[P2P] Send buffer full for client %s, dropping message", client.ID)
	}
}
