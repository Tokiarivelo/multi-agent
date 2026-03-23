# Testing Rules

## Philosophy: TDD by Default
Write the test before the implementation. If you can't write the test first, write it immediately after — before moving to the next file.

## Test Structure

### Unit Tests
- Location: `<source-file>.test.ts` (co-located)
- Scope: one function/class in isolation
- Mocks: all external I/O (DB, NATS, HTTP, timers)
- Speed: must complete in < 100ms per test

```typescript
// Pattern: Arrange → Act → Assert
it('retries on transient failure', async () => {
  const publisher = new Publisher({ maxRetries: 3 })
  publisher.nats.publish = vi.fn()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(undefined)

  await publisher.send('events.user', { id: '1' })

  expect(publisher.nats.publish).toHaveBeenCalledTimes(2)
})
```

### Integration Tests
- Location: `<service>/src/__tests__/integration/`
- Scope: service + real DB (Docker Compose required)
- Naming: `*.integration.test.ts`
- Cleanup: truncate test data after each test

### E2E Tests
- Location: `frontend/e2e/` or `services/e2e/`
- Required for: auth flows, payment flows, critical agent pipelines

## Coverage Requirements
| Layer | Minimum |
|-------|---------|
| Business logic | 80% |
| API handlers | 70% |
| DB layer | integration tests |

## Commands
```bash
pnpm test
pnpm --filter @multi-agent/api test -- --coverage
pnpm --filter @multi-agent/api test -- --watch
```

## Test Quality Rules
- One assertion concept per test
- Test names: `it('does X when Y')` — behavior, not implementation
- No `test.only` or `test.skip` in committed code
- No `setTimeout` in tests — use `vi.useFakeTimers()`
- Failing tests block commits — fix or document the skip reason

## Mock Patterns

```typescript
vi.mock('@multi-agent/database', () => ({
  db: {
    workflow: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))
```
