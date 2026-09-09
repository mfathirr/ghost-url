package p2p

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for P2P signaling
	},
}

// Handler coordinates WebSocket upgrade and client lifecycle.
type Handler struct {
	hub *Hub
}

// NewHandler creates a new P2P Handler.
func NewHandler(hub *Hub) *Handler {
	return &Handler{
		hub: hub,
	}
}

// ExtractClientIP extracts the public client IP according to spec:
// CF-Connecting-IP -> X-Forwarded-For (first IP) -> X-Real-IP -> RemoteAddr without port.
func ExtractClientIP(r *http.Request) string {
	// 1. Cloudflare header
	if cfIP := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cfIP != "" {
		return cfIP
	}

	// 2. X-Forwarded-For (first client IP in comma-separated list)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}

	// 3. X-Real-IP
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	// 4. RemoteAddr fallback (strip port)
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}

	return strings.TrimSpace(r.RemoteAddr)
}

// generateClientID produces a cryptographically secure 16-character hex identifier.
func generateClientID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("peer-%d", len(b))
	}
	return hex.EncodeToString(b)
}

// ServeWS handles GET /ws/p2p
func (h *Handler) ServeWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[P2P] WebSocket upgrade failed: %v", err)
		return
	}

	clientIP := ExtractClientIP(c.Request)

	// Determine room: if user explicitly provided a room code via query param (?room=...), use it
	var roomID string
	rawRoom := strings.TrimSpace(c.Query("room"))
	if rawRoom != "" {
		rawRoom = strings.TrimPrefix(rawRoom, "room:")
		roomID = "room:" + rawRoom
	} else {
		roomID = "ip:" + clientIP
	}

	ua := c.Request.UserAgent()
	osName, deviceType := ParseUserAgent(ua)
	name := GenerateRandomName()
	clientID := generateClientID()

	client := &Client{
		ID:         clientID,
		Name:       name,
		OS:         osName,
		DeviceType: deviceType,
		RoomID:     roomID,
		Hub:        h.hub,
		Conn:       conn,
		Send:       make(chan []byte, 1024),
	}

	h.hub.Register <- client

	// Start read/write pumps in separate goroutines
	go client.WritePump()
	go client.ReadPump()
}
