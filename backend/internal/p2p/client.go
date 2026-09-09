package p2p

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // 512 KB
)

// Client represents a single active WebSocket peer connection.
type Client struct {
	ID         string
	Name       string
	OS         string
	DeviceType string
	RoomID     string
	Hub        *Hub
	Conn       *websocket.Conn
	Send       chan []byte

	closeOnce sync.Once
}

// Info returns the public PeerInfo struct for this client.
func (c *Client) Info() PeerInfo {
	return PeerInfo{
		ID:         c.ID,
		Name:       c.Name,
		OS:         c.OS,
		DeviceType: c.DeviceType,
	}
}

// Close gracefully closes the send channel once.
func (c *Client) Close() {
	c.closeOnce.Do(func() {
		close(c.Send)
	})
}

// ReadPump listens for incoming WebSocket messages and routes them through the Hub.
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("P2P Client %s disconnected unexpectedly: %v", c.ID, err)
			}
			break
		}

		var sigMsg SignalMessage
		if err := json.Unmarshal(message, &sigMsg); err != nil {
			log.Printf("P2P Client %s sent invalid JSON: %v", c.ID, err)
			continue
		}

		// Always stamp the message sender with client ID for security
		sigMsg.From = c.ID
		c.Hub.RouteMessage(c, sigMsg)
	}
}

// WritePump writes outgoing messages from the Send channel to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			if _, err := w.Write(message); err != nil {
				return
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
