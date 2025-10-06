# MCP To-Do List

Simple project-local to-do list tracker for Claude Code.

## Features

- `add_todo` - Add a task to the project to-do list
- `remove_todo` - Remove a task by index (1-based)
- `list_todos` - View all tasks

Tasks are stored in `.project-todos.json` in the project root.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Add to Claude Code MCP settings (`~/.claude/config.json`):
```json
{
  "mcpServers": {
    "todo-list": {
      "command": "node",
      "args": ["/path/to/claude-code-tools/mcp-tools/todo-list/index.js"]
    }
  }
}
```

## Usage

**Add a task:**
> Claude, I need to remember to fix the placeholder code I added in the verifier agent. Add it to the to-do list for me

**List tasks:**
> Claude, show me the to-do list

**Remove a task:**
> Claude, remove item 2 from the to-do list
