---
description: List project todos, optionally filtered by category (project, gitignored)
tools: [mcp__tdl__display_todos]
args:
  - name: category
    description: Optional category to filter by
    required: false
---

/t

Call mcp__tdl__display_todos with category parameter set to: $1

If $1 is empty, call with no category parameter.
