---
trigger: always_on
---

# AI Agent & Output Rules

Separate the following responsibilities distinctly:

- Prompt templates
- Orchestration
- Execution
- Tool usage
- Model provider
- Vector memory

Never tightly couple orchestration and LLM calls.

## Output Requirements for LLM Generative Solutions

When generating solutions, ALWAYS:

1. Respect structure
2. Specify file placement
3. Maintain modular design
4. Include testing strategy
5. Mention documentation updates
6. Mention Makefile updates
7. Always make it multi-language (en-us and FR)

If one is missing → solution is incomplete.
