package ws

import (
	"encoding/json"
	"testing"
)

func TestFormatMessage_WithEventType(t *testing.T) {
	r := &Relay{}
	raw := []byte(`{"eventType":"execution:update","data":{"id":"abc"},"extra":"ignored"}`)

	msg := r.formatMessage(raw)

	if msg["event"] != "execution:update" {
		t.Errorf("event = %v, want execution:update", msg["event"])
	}
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		t.Fatal("data should be map[string]interface{}")
	}
	if data["id"] != "abc" {
		t.Errorf("data.id = %v, want abc", data["id"])
	}
}

func TestFormatMessage_WithoutEventType(t *testing.T) {
	r := &Relay{}
	raw := []byte(`{"foo":"bar"}`)

	msg := r.formatMessage(raw)

	if msg["event"] != "nats.message" {
		t.Errorf("event = %v, want nats.message", msg["event"])
	}
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		t.Fatal("data should be map[string]interface{}")
	}
	if data["foo"] != "bar" {
		t.Errorf("data.foo = %v, want bar", data["foo"])
	}
}

func TestFormatMessage_InvalidJSON(t *testing.T) {
	r := &Relay{}
	raw := []byte(`not-valid-json`)

	msg := r.formatMessage(raw)

	if msg["event"] != "nats.message" {
		t.Errorf("event = %v, want nats.message", msg["event"])
	}
	if msg["data"] != string(raw) {
		t.Errorf("data = %v, want %q", msg["data"], string(raw))
	}
}

func TestFormatMessage_EventTypeWithNilData(t *testing.T) {
	r := &Relay{}
	// When "data" key is absent, the whole payload becomes data.
	raw := []byte(`{"eventType":"token:progress","value":42}`)

	msg := r.formatMessage(raw)

	if msg["event"] != "token:progress" {
		t.Errorf("event = %v, want token:progress", msg["event"])
	}
	// data should fall back to the full payload
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		t.Fatal("data should be map[string]interface{}")
	}
	if data["value"] != float64(42) {
		t.Errorf("data.value = %v, want 42", data["value"])
	}
}

func TestFormatMessage_RoundTrip(t *testing.T) {
	r := &Relay{}
	original := map[string]interface{}{
		"eventType": "node:update",
		"data":      map[string]interface{}{"nodeId": "n1", "status": "running"},
	}
	raw, _ := json.Marshal(original)

	msg := r.formatMessage(raw)
	out, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded map[string]interface{}
	_ = json.Unmarshal(out, &decoded)

	if decoded["event"] != "node:update" {
		t.Errorf("event = %v, want node:update", decoded["event"])
	}
}
