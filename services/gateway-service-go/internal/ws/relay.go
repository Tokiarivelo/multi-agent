// Package ws implements the WebSocket ↔ NATS relay that replaces the
// TypeScript EventsGateway. It accepts WebSocket connections at GET /ws,
// subscribes to all NATS subjects (">" wildcard), and fans out every message
// to all connected clients.
package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/multi-agent/gateway-service-go/internal/messaging"
	"github.com/nats-io/nats.go"
	"nhooyr.io/websocket"
)

// Relay manages connected WebSocket clients and bridges NATS messages to them.
type Relay struct {
	nats    *messaging.Client
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
}

// NewRelay constructs a Relay, subscribes to NATS, and starts the fan-out loop.
func NewRelay(natsClient *messaging.Client) *Relay {
	r := &Relay{
		nats:    natsClient,
		clients: make(map[*websocket.Conn]struct{}),
	}
	r.subscribeNATS()
	return r
}

// RegisterRoutes attaches the /ws endpoint to r.
func RegisterRoutes(r *gin.Engine, relay *Relay) {
	r.GET("/ws", relay.Handle)
}

// Handle upgrades an HTTP connection to WebSocket, registers the client, and
// blocks until the client disconnects.
func (r *Relay) Handle(c *gin.Context) {
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{
		// Accept all origins during development; restrict in production via env.
		InsecureSkipVerify: true,
	})
	if err != nil {
		return
	}

	r.addClient(conn)
	defer r.removeClient(conn)

	// Send initial "connected" event — mirrors TypeScript handleConnection.
	connected, _ := json.Marshal(map[string]interface{}{
		"event": "connected",
		"data":  "Gateway Connected",
	})
	_ = conn.Write(c.Request.Context(), websocket.MessageText, connected)

	// Block until client closes the connection or context is cancelled.
	for {
		_, _, err := conn.Read(c.Request.Context())
		if err != nil {
			break
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

func (r *Relay) addClient(conn *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[conn] = struct{}{}
}

func (r *Relay) removeClient(conn *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, conn)
	_ = conn.Close(websocket.StatusNormalClosure, "")
}

// subscribeNATS subscribes to all NATS subjects and fans out messages to every
// connected WebSocket client.
func (r *Relay) subscribeNATS() {
	_, err := r.nats.Subscribe(">", func(msg *nats.Msg) {
		outbound := r.formatMessage(msg.Data)

		payload, err := json.Marshal(outbound)
		if err != nil {
			fmt.Printf("ws: marshal error: %v\n", err)
			return
		}

		r.broadcast(payload)
	})
	if err != nil {
		fmt.Printf("ws: NATS subscribe error: %v\n", err)
	}
}

// formatMessage converts a raw NATS payload to the WebSocket envelope format.
// Mirrors the TypeScript subscribeToNatsEvents logic:
//   - If the JSON has an "eventType" key → { event: eventType, data: data }
//   - Otherwise                          → { event: "nats.message", data: payload }
func (r *Relay) formatMessage(raw []byte) map[string]interface{} {
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return map[string]interface{}{
			"event": "nats.message",
			"data":  string(raw),
		}
	}

	if eventType, ok := payload["eventType"]; ok {
		data := payload["data"]
		if data == nil {
			data = payload
		}
		return map[string]interface{}{
			"event": eventType,
			"data":  data,
		}
	}

	return map[string]interface{}{
		"event": "nats.message",
		"data":  payload,
	}
}

// broadcast sends payload to all currently connected WebSocket clients.
// Uses a 5-second write deadline per client; slow clients are dropped.
func (r *Relay) broadcast(payload []byte) {
	r.mu.RLock()
	snapshot := make([]*websocket.Conn, 0, len(r.clients))
	for conn := range r.clients {
		snapshot = append(snapshot, conn)
	}
	r.mu.RUnlock()

	for _, conn := range snapshot {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := conn.Write(ctx, websocket.MessageText, payload); err != nil {
			cancel()
			r.removeClient(conn)
			continue
		}
		cancel()
	}
}
