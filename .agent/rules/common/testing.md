---
trigger: always_on
---
# Testing Requirements

Every feature requires:
- Unit tests
- Integration tests (if applicable)
- Mocked external systems (LLM, NATS, DB)
- Deterministic behavior

**Missing tests = incomplete task.**

Always follow a TDD (Test-Driven Development) approach when implementing new logic. Ensure that all pipelines run cleanly before considering a feature complete.
