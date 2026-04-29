// Package messaging provides the NATS client used by the WebSocket relay.
package messaging

import (
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
)

// Client wraps a nats.Conn with convenience helpers.
type Client struct {
	conn *nats.Conn
}

// Connect establishes a NATS connection with unlimited reconnects and returns a
// Client. The caller is responsible for calling Close when done.
func Connect(natsURL string) (*Client, error) {
	nc, err := nats.Connect(
		natsURL,
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			if err != nil {
				fmt.Printf("messaging: NATS disconnected: %v\n", err)
			}
		}),
		nats.ReconnectHandler(func(_ *nats.Conn) {
			fmt.Println("messaging: NATS reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("messaging: failed to connect to NATS: %w", err)
	}

	return &Client{conn: nc}, nil
}

// Subscribe registers a handler for the given subject. Use ">" for a wildcard
// that matches all subjects.
func (c *Client) Subscribe(subject string, handler nats.MsgHandler) (*nats.Subscription, error) {
	sub, err := c.conn.Subscribe(subject, handler)
	if err != nil {
		return nil, fmt.Errorf("messaging: subscribe %q: %w", subject, err)
	}

	return sub, nil
}

// Close drains and closes the NATS connection.
func (c *Client) Close() {
	_ = c.conn.Drain()
}
