package users

import (
	"encoding/json"
	"testing"
)

func TestResolveSettings_Empty(t *testing.T) {
	result := resolveSettings(nil)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatal("expected map[string]interface{}")
	}
	if _, has := m["indexableExtensions"]; !has {
		t.Error("expected indexableExtensions key in default settings")
	}
}

func TestResolveSettings_EmptyObject(t *testing.T) {
	result := resolveSettings(json.RawMessage("{}"))
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatal("expected map[string]interface{}")
	}
	if _, has := m["indexableExtensions"]; !has {
		t.Error("expected default settings when stored settings is empty object")
	}
}

func TestResolveSettings_Populated(t *testing.T) {
	raw := json.RawMessage(`{"theme":"dark","indexableExtensions":["go","ts"]}`)
	result := resolveSettings(raw)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatal("expected map[string]interface{}")
	}
	if m["theme"] != "dark" {
		t.Errorf("theme = %v, want dark", m["theme"])
	}
}

func TestMergeSettings(t *testing.T) {
	existing := json.RawMessage(`{"theme":"light","lang":"en"}`)
	patch := json.RawMessage(`{"theme":"dark","newKey":"value"}`)

	result, err := mergeSettings(existing, patch)
	if err != nil {
		t.Fatalf("mergeSettings error: %v", err)
	}

	if result["theme"] != "dark" {
		t.Errorf("theme after merge = %v, want dark", result["theme"])
	}
	if result["lang"] != "en" {
		t.Errorf("lang after merge = %v, want en", result["lang"])
	}
	if result["newKey"] != "value" {
		t.Errorf("newKey after merge = %v, want value", result["newKey"])
	}
}

func TestMergeSettings_EmptyExisting(t *testing.T) {
	patch := json.RawMessage(`{"key":"val"}`)
	result, err := mergeSettings(nil, patch)
	if err != nil {
		t.Fatalf("mergeSettings error: %v", err)
	}
	if result["key"] != "val" {
		t.Errorf("key = %v, want val", result["key"])
	}
}

func TestMergeSettings_InvalidPatch(t *testing.T) {
	_, err := mergeSettings(nil, json.RawMessage(`not-json`))
	if err == nil {
		t.Error("expected error for invalid JSON patch")
	}
}
