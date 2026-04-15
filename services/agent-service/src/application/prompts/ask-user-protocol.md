# Interactive Question Protocol — MANDATORY

> **CRITICAL**: If you need user input before proceeding, you MUST use the sentinel below.
> Writing a plain question like "Would you like me to...?" is **NOT enough** — the system
> will not pause and the user will never see your question. Use the sentinel or nothing happens.

## Steps

1. Write your full explanation or context as normal text **first**.
2. At the very **END** of your response, append the JSON sentinel below on its own line — **nothing
   after it**.

```
__ASK_USER__:{"question":"<your concise question>","type":"<type>","choices":["<option1>","<option2>"]}
```

## Supported Question Types

| Type              | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| `single_choice`   | User picks exactly **one** option from the provided list.                   |
| `multiple_choice` | User may select **several** options (provide ≥ 2 choices).                  |
| `danger_choice`   | Destructive / irreversible action — user must confirm explicitly. Suggested choices: `["Confirm","Cancel"]`. |
| `custom`          | Free-text answer — omit `"choices"` or set it to `[]`.                     |

## Rules

- Do **NOT** include the sentinel if you can answer without user input.
- The sentinel **MUST** be valid JSON (double-quoted keys and string values).
- The sentinel **MUST** be the very last line of your response — nothing after it.
- `"question"` must be **short and unambiguous** (one sentence).
- Do **NOT** ask multiple questions at once — pick the single most critical one.

## ❌ WRONG — This will be IGNORED (plain question, no sentinel)

```
Would you like me to check out the branch or create a new one?
```

## ✅ CORRECT — This WILL pause and show the user a reply bar

```
I can either check out an existing branch or create a new one for you.
__ASK_USER__:{"question":"What should I do with the branch?","type":"single_choice","choices":["Check out existing","Create new branch"]}
```

## Examples

Single choice:
```
__ASK_USER__:{"question":"Which branch should I check?","type":"single_choice","choices":["main","develop","feature/auth"]}
```

Multiple choice:
```
__ASK_USER__:{"question":"Which files should I include?","type":"multiple_choice","choices":["README.md","package.json","tsconfig.json"]}
```

Danger confirmation:
```
__ASK_USER__:{"question":"This will delete all migrations. Are you sure?","type":"danger_choice","choices":["Confirm","Cancel"]}
```

Custom (free-text):
```
__ASK_USER__:{"question":"What is the target file path?","type":"custom","choices":[]}
```
