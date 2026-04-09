# Testing Rules

## Philosophy: TDD by Default
Write the test before the implementation. If you can't, write it immediately after — before moving to the next file.

## Test Structure

**Unit** — co-located as `<source-file>.test.ts`, mocks all external I/O, < 100ms per test
**Integration** — `<service>/src/__tests__/integration/*.integration.test.ts`, real DB via Docker Compose, truncate after each test
**E2E** — `frontend/e2e/` or `services/e2e/`, required for auth flows, payment flows, critical pipelines

```typescript
// Arrange → Act → Assert
it('retries on transient failure', async () => {
  const publisher = new Publisher({ maxRetries: 3 })
  publisher.nats.publish = vi.fn()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(undefined)
  await publisher.send('events.user', { id: '1' })
  expect(publisher.nats.publish).toHaveBeenCalledTimes(2)
})
```

## Coverage
| Layer | Minimum |
|-------|---------|
| Business logic | 80% |
| API handlers | 70% |
| DB layer | integration tests |

## Quality Rules
- One assertion concept per test; name as `it('does X when Y')`
- No `test.only` / `test.skip` in committed code
- No `setTimeout` — use `vi.useFakeTimers()`
- Failing tests block commits

## Mock Pattern
```typescript
vi.mock('@multi-agent/database', () => ({
  db: { workflow: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) } },
}))
```

## Commands
```bash
pnpm test
pnpm --filter @multi-agent/api test -- --coverage
```
