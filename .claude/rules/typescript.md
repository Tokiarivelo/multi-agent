# TypeScript Rules

## Compiler
```json
{ "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true }
```
All three must be on. Never disable with `// @ts-ignore` — fix the type.

## Prefer
```typescript
// unknown over any
function parse(input: unknown): WorkflowConfig {
  if (!isWorkflowConfig(input)) throw new TypeError('Invalid config')
  return input
}

// Discriminated unions over boolean flags
type AgentState =
  | { status: 'idle' }
  | { status: 'running'; jobId: string }
  | { status: 'failed'; error: Error }

// satisfies for literal inference with type checking
const config = { retries: 3, timeout: 5000 } satisfies Partial<PublisherConfig>
```

## Async
```typescript
// Always await or return — never fire-and-forget without error handling
const [users, workflows] = await Promise.all([
  db.user.findMany(),
  db.workflow.findMany(),
])
```

## Zod — Runtime Validation at Boundaries
```typescript
const WorkflowInputSchema = z.object({
  name: z.string().min(1).max(100),
  steps: z.array(StepSchema).min(1),
})
type WorkflowInput = z.infer<typeof WorkflowInputSchema>
const input = WorkflowInputSchema.parse(req.body)
```

## Error Hierarchy
```typescript
export class AppError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = this.constructor.name
  }
}
export class WorkflowError extends AppError {}
export class ValidationError extends AppError {
  constructor(message: string, public readonly field: string) { super(message) }
}
```
