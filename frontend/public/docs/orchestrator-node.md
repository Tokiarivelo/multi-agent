# Orchestrator Node — Implementation Guide

The **ORCHESTRATOR** node lets an AI agent loop, retry, and dynamically spawn
sub-agents without manual wiring. It is the right choice whenever a task is
too open-ended for a single linear agent call.

---

## When to use it

| Situation | Use |
|-----------|-----|
| Task complexity is unknown upfront | ORCHESTRATOR |
| Agent needs multiple passes to refine output | ORCHESTRATOR |
| Work can be split across parallel specialists | ORCHESTRATOR |
| Fixed, predictable pipeline | Regular AGENT nodes |

---

## Node config reference

| Field | Default | Description |
|---|---|---|
| `agentId` | *(required)* | The orchestrator agent ID |
| `maxIterations` | `10` | Hard cap on loop iterations (1–100) |
| `maxRetries` | `3` | Retry attempts per iteration on agent failure |
| `retryBackoffMs` | `1000` | Base backoff in ms — doubles each retry |
| `terminateWhen` | `''` | JS expression `(output, iteration, results, context) => bool` |
| `subAgentStrategy` | `'auto'` | `'auto'` enables `__SPAWN_SUBAGENTS__` parsing; `'disabled'` turns it off |
| `continueOnSubAgentFailure` | `false` | If `true`, failed sub-agents don't abort the iteration |
| `toolIds` | `[]` | Extra tool IDs given to the orchestrator agent each iteration |
| `subAgents` | `[]` | Static sub-agents always registered with the orchestrator |
| `maxTokens` | `0` | Override agent token limit (0 = use agent default) |

---

## Agent signal protocol

The orchestrator agent communicates control signals via its **text output**.

### Stop the loop

```
I am done processing all tasks. Final answer: ...

__DONE__
```

The loop terminates immediately when `__DONE__` appears anywhere in the output.

### Spawn sub-agents in parallel

```
Breaking this into three parallel tasks.

__SPAWN_SUBAGENTS__:[
  {"agentId": "researcher-agent", "input": {"topic": "climate change"}},
  {"agentId": "coder-agent",      "input": {"task": "write a summary function"}},
  {"agentId": "reviewer-agent",   "input": {"code": "..."}}
]
```

Rules:
- Must be valid JSON array immediately after `__SPAWN_SUBAGENTS__:`
- Each element: `{ agentId: string, input: object, toolIds?: string[] }`
- All sub-agents run **in parallel** — the orchestrator waits for all before continuing
- Sub-agent outputs arrive as `subAgentOutputs[]` in the next iteration's `_previousOutput`
- Only works when `subAgentStrategy = 'auto'`

---

## Iteration input shape

Each iteration receives the original node input **plus** injected fields:

```typescript
{
  ...originalInput,
  _iteration: number,          // 0-based current iteration index
  _previousOutput: unknown,    // output of the previous iteration (null on first)
  _results: Array<{            // all previous iteration results
    iteration: number,
    output: unknown,
    subAgentOutputs?: unknown[],
  }>,
}
```

---

## Output shape

```typescript
{
  output: unknown,             // last iteration's output
  iterations: number,          // total iterations that ran
  results: Array<{
    iteration: number,
    output: unknown,
    subAgentOutputs?: unknown[],
  }>,
}
```

Access in downstream nodes via context variables, e.g.:
- `{{output}}` — final output
- `{{iterations}}` — count of loops
- `{{results}}` — full history array

---

## terminateWhen expression

The expression is evaluated as a JS function body after each iteration.
Available variables:

| Variable | Type | Description |
|---|---|---|
| `output` | `unknown` | Current iteration output |
| `iteration` | `number` | Current 0-based index |
| `results` | `array` | All results so far |
| `context` | `object` | Workflow context variables |

Examples:

```js
// Stop when agent says it's done
return typeof output === 'object' && output?.status === 'done';

// Stop after the agent produces a non-empty result
return typeof output?.answer === 'string' && output.answer.length > 10;

// Stop when 3 successful sub-agent outputs exist
return results.filter(r => r.subAgentOutputs?.length > 0).length >= 3;
```

---

## Example: iterative research + synthesis

```
START
  └── ORCHESTRATOR (agentId: research-orchestrator, maxIterations: 5)
        subAgents: [web-researcher, fact-checker]
        terminateWhen: return output?.confidence > 0.9;
  └── AGENT (agentId: writer-agent)
  └── END
```

**research-orchestrator system prompt:**
```
You are a research orchestrator. Each iteration you receive:
- _iteration: current loop number
- _previousOutput: what you produced last time
- _results: all prior results

Your job:
1. Assess if you have enough reliable information.
2. If not, spawn specialized sub-agents to gather more:
   __SPAWN_SUBAGENTS__:[{"agentId":"web-researcher","input":{"query":"..."}}]
3. When confidence is high, output {"confidence": 0.95, "findings": "..."} and signal:
   __DONE__
```

---

## Example: parallel task decomposition

```
START
  └── ORCHESTRATOR (agentId: planner-agent, maxIterations: 1, subAgentStrategy: auto)
        subAgents: [coder-agent, tester-agent, reviewer-agent]
  └── TRANSFORM (merge results)
  └── END
```

**planner-agent** decomposes the work in a single iteration and spawns specialists:

```
I will split this feature into three parallel tasks.

__SPAWN_SUBAGENTS__:[
  {"agentId": "coder-agent",    "input": {"spec": "implement login endpoint"}},
  {"agentId": "tester-agent",   "input": {"spec": "write login tests"}},
  {"agentId": "reviewer-agent", "input": {"spec": "review security requirements"}}
]

__DONE__
```

---

## Retry behavior

When an agent call fails:

```
attempt 1 → fails
  wait retryBackoffMs * 2^0 = 1000ms
attempt 2 → fails
  wait retryBackoffMs * 2^1 = 2000ms
attempt 3 → fails
  wait retryBackoffMs * 2^2 = 4000ms
attempt 4 → still fails → throw (node FAILED)
```

Total retries = `maxRetries`. Set to `0` to disable retrying (fail fast).

---

## Limits

| Constraint | Value |
|---|---|
| `maxIterations` hard cap | 100 |
| Sub-agents per spawn signal | unlimited (runs in parallel) |
| Retry backoff base | configurable, doubles each retry |
| Circular sub-agent calls | not prevented — avoid self-reference |

---

## Tutorial: Step-by-step — your first orchestrator

This section walks from zero to a working orchestrator in five concrete steps.

### Step 1 — Design your stopping condition first

Before writing any agent prompt, answer: **"How will I know the task is done?"**

Good stopping conditions:
- Agent produces a structured field: `output?.score >= 0.8`
- Agent has collected N items: `output?.items?.length >= 5`
- Agent explicitly signals: use `__DONE__` (no expression needed)

Bad stopping conditions:
- `iteration >= 3` — that's just `maxIterations`, not a semantic condition
- Nothing — agent will always run `maxIterations` and waste tokens

Write the `terminateWhen` expression before the prompt. It forces you to define
done precisely, which then shapes the agent's output contract.

---

### Step 2 — Give the agent a strict JSON output contract

Every orchestrator agent must output a **parseable, consistent object** so that
`terminateWhen` and downstream nodes can rely on it.

Add this to the agent's system prompt:

```
## Output format (STRICT)
Always end your response with a JSON block:

```json
{
  "status": "in_progress" | "done",
  "confidence": 0.0–1.0,
  "result": <your main output here>,
  "reasoning": "<one sentence explaining your decision>"
}
```

If spawning sub-agents, put __SPAWN_SUBAGENTS__:[...] BEFORE the JSON block.
If done, put __DONE__ AFTER the JSON block.
```

Then in `terminateWhen`:
```js
return output?.output?.status === 'done';
```

This keeps signal parsing and business logic completely separate.

---

### Step 3 — Start with maxIterations: 1 (single-shot)

Before building a loop, make a single-iteration orchestrator work correctly:

1. Set `maxIterations: 1`, `maxRetries: 0`
2. Run the workflow with a sample input
3. Check the execution logs — confirm the output JSON is valid
4. Confirm `terminateWhen` evaluates correctly on that output

Only increase `maxIterations` after the single-shot works. Loops hide bugs
behind "it eventually worked." Single-shot forces you to fix the prompt first.

---

### Step 4 — Add sub-agents one at a time

Do not wire up 4 sub-agents at once. Add them incrementally:

1. Add one sub-agent (e.g., `researcher-agent`)
2. Add a line to the orchestrator prompt: instruct it to spawn only that agent
3. Run and verify the sub-agent output shape in execution logs
4. Only then add the next sub-agent

Each sub-agent needs its own output contract. Document it in the sub-agent's
system prompt too — the orchestrator needs to know what to expect back.

---

### Step 5 — Harden with retries and partial failure

Once the happy path works:

1. Set `maxRetries: 2`, `retryBackoffMs: 500`
2. Simulate a failure by temporarily breaking one sub-agent's input
3. Confirm the retry logs appear in the execution panel
4. Decide if `continueOnSubAgentFailure: true` is safe for your use case

Rule of thumb:
- Research / enrichment tasks: `continueOnSubAgentFailure: true` (one bad source is ok)
- Write / code generation tasks: `continueOnSubAgentFailure: false` (partial code is worse than no code)

---

## Best practices

### Prompt design

**Always include the iteration context in the prompt.**
The agent cannot improve across loops unless its prompt tells it to look at
`_previousOutput` and `_results`. Add this block to every orchestrator agent:

```
## Context from previous iterations
- Current iteration: {{_iteration}}
- Previous output: {{_previousOutput}}
- Full history: {{_results}}

Use this context to avoid repeating work and to build on prior results.
```

**Keep the orchestrator agent narrow.**
Its only jobs are: assess the situation, decide what to delegate, synthesize
results. It should not do heavy work itself. Heavy work goes in sub-agents.

**Give sub-agents focused, single-responsibility prompts.**
A sub-agent called "researcher" should only research. If it also summarizes, the
orchestrator cannot reuse it for research-only tasks in other workflows.

---

### Configuration

**Use `terminateWhen` over `maxIterations` for semantic stopping.**
`maxIterations` is a safety net, not a control flow tool. If your workflow
always runs exactly 5 iterations, use a LOOP node instead.

**Set `maxIterations` to 2× your expected iterations.**
If you expect 3 loops, set `maxIterations: 6`. This absorbs unexpected retries
without hitting the cap in normal operation.

**Do not spawn more than 5 sub-agents per signal.**
Each spawned agent is a concurrent HTTP call to the agent service. Beyond 5,
you risk overwhelming the service and triggering timeouts. If you need more,
batch them across iterations.

**Prefer small `retryBackoffMs` (200–500ms) for interactive workflows,**
and larger values (1000–2000ms) for background batch processing. The default
1000ms is safe but feels slow in a real-time UI.

---

### Output design

**Always include a `status` field in the output JSON.**
It makes `terminateWhen` trivial and self-documenting:
```js
return output?.output?.status === 'done';
```

**Accumulate, don't replace.**
Design agent outputs to be additive: each iteration should add to `_results`,
not overwrite. The full history is available — use it. This also makes debugging
much easier because you can inspect exactly what changed each loop.

**Summarize before passing to the next node.**
The `results` array grows with every iteration. If a downstream AGENT or
TRANSFORM node consumes `{{results}}`, it will receive the entire history.
Add a post-ORCHESTRATOR TRANSFORM node to extract only what's needed:
```js
return { finalAnswer: data.output, loopCount: data.iterations };
```

---

## Testing tips

### Unit: test the agent prompt in isolation

Before wiring the orchestrator, test the agent alone via the **Agent** node or
the agent playground. Send a mock input that mimics what the orchestrator injects:

```json
{
  "task": "summarize the climate report",
  "_iteration": 0,
  "_previousOutput": null,
  "_results": []
}
```

Verify:
- Output is valid JSON matching your contract
- `status` field is present and correct
- `__DONE__` / `__SPAWN_SUBAGENTS__` signals appear only when expected
- The agent does NOT hallucinate agent IDs in `__SPAWN_SUBAGENTS__`

---

### Integration: test the full loop with a stub sub-agent

Create a **stub agent** with a simple, deterministic prompt:

```
You are a test stub. Always respond with exactly:
{"result": "stub-output", "status": "done"}
```

Use this stub as the sub-agent during integration testing. It lets you verify
the full loop, retry, and signal-parsing logic without depending on real AI
output. Replace the stub with the real agent only after the loop logic is proven.

---

### Chaos test: force retries and partial failures

**Test retry logic:**
1. Set `maxRetries: 2`
2. Temporarily give the orchestrator agent an invalid `agentId` (one that doesn't exist)
3. Run the workflow and confirm the execution logs show 3 total attempts with backoff delays
4. Confirm the node status becomes FAILED after exhausting retries

**Test partial failure tolerance:**
1. Set `continueOnSubAgentFailure: true`
2. Add a sub-agent that always fails (invalid agent ID)
3. Run and confirm: the orchestrator continues, the failed sub-agent's output is `{ error: "..." }`
4. Confirm downstream nodes receive the result with the partial failure noted

**Test `__DONE__` early exit:**
1. Set `maxIterations: 10`
2. Configure the agent to always emit `__DONE__` on iteration 0
3. Verify `iterations: 1` in the output (not 10)

**Test `terminateWhen` short-circuit:**
1. Set `terminateWhen` to `return iteration >= 1;`
2. Set `maxIterations: 10`
3. Verify the loop stops after 2 iterations (0 and 1)

---

### Regression: lock the output contract

Once your orchestrator works correctly, add a snapshot test for the output shape.
In `services/orchestration-service/src/__tests__/integration/`:

```typescript
it('orchestrator node returns correct shape', async () => {
  const result = await executeWorkflowFixture('orchestrator-smoke-test');
  expect(result.output).toMatchObject({
    output: expect.anything(),
    iterations: expect.any(Number),
    results: expect.arrayContaining([
      expect.objectContaining({ iteration: expect.any(Number) }),
    ]),
  });
  expect(result.iterations).toBeGreaterThan(0);
});
```

This test catches silent prompt regressions — if the agent stops emitting `__DONE__`
or changes its JSON schema, the test fails before it reaches production.

---

### Observability checklist before going live

- [ ] Execution logs show `[LOG] ORCHESTRATOR: starting iteration N/M` for each loop
- [ ] Execution logs show `[LOG] ORCHESTRATOR: spawning N sub-agent(s) in parallel` when spawning
- [ ] Execution logs show `[LOG] ORCHESTRATOR: __DONE__ signal received` on termination
- [ ] `iterations` in output matches what the logs show
- [ ] Node status is COMPLETED (not FAILED) on a happy-path run
- [ ] Node status is FAILED with a clear error message when `maxRetries` is exhausted
- [ ] WebSocket events fire for each iteration (visible in the workflow canvas as RUNNING pulse)
