# Project Todo List

A comprehensive todo list system for Claude Code that integrates both MCP tools (for Claude) and slash commands (for direct user execution).

## Features

- **Shared Todo List**: Stored in `.project-todos.json` in the project root
- **Dual Interface**:
  - MCP tools for Claude to manage todos
  - Slash commands for immediate user execution
- **Beautiful Display**: Colored ANSI boxes (~45 chars wide) using `boxen`
- **Persistent**: Todos survive between Claude Code sessions

## Architecture

### MCP Server (`index.js`)
Provides tools that Claude can use:
- `add_todo` - Add a task
- `remove_todo` - Remove a task by index
- `list_todos` - List all tasks
- `clear_todos` - Clear all tasks

### CLI Tool (`cli.js`)
Direct command-line interface:
```bash
node cli.js list                    # Show all todos
node cli.js add "Task description"  # Add a todo
node cli.js remove 3                # Remove todo #3
node cli.js clear                   # Clear all todos
```

### Slash Commands
Four commands installed in `.claude/commands/`:
- `/todo-list` - Display todos (executes immediately)
- `/todo-add <task>` - Add a todo (executes immediately)
- `/todo-remove <num>` - Remove a todo (executes immediately)
- `/todo-clear` - Clear all todos (executes immediately)

## Installation

```bash
./install.sh
```

The install script:
1. Installs npm dependencies
2. Creates/updates `.mcp.json` with MCP server config
3. Creates slash commands in `.claude/commands/`
4. Makes scripts executable

After installation:
1. Restart Claude Code to load the MCP server
2. Slash commands work immediately (no restart needed)

## Usage

### Using Slash Commands (Direct Execution)

```bash
# Show todos
/todo-list

# Add a todo
/todo-add Implement authentication

# Remove todo #2
/todo-remove 2

# Clear all todos
/todo-clear
```

Slash commands execute immediately without waiting for Claude.

### Using MCP Tools (Via Claude)

Talk to Claude:
- "Add 'Fix bug in parser' to the todo list"
- "Show me the todos"
- "Remove item 3 from the todo list"
- "Clear all todos"

Claude will use the MCP tools to manage the list.

## Display Format

Todos are displayed in a colored box:

```
╭ 📋 Project To-Dos (3) ────────────────────╮
│                                           │
│   1. Implement authentication             │
│   Oct 4                                   │
│                                           │
│   2. Fix bug in parser                    │
│   Oct 4                                   │
│                                           │
│   3. Write documentation                  │
│   Oct 4                                   │
│                                           │
╰───────────────────────────────────────────╯
```

## Data Format

`.project-todos.json`:
```json
[
  {
    "task": "Implement authentication",
    "added": "2025-10-04T13:00:00.000Z"
  },
  {
    "task": "Fix bug in parser",
    "added": "2025-10-04T13:01:00.000Z"
  }
]
```

## File Structure

```
mcp-tools/todo-list/
├── package.json          # Dependencies
├── index.js              # MCP server
├── cli.js                # CLI tool
├── lib.js                # Shared functions
├── install.sh            # Installation script
├── README.md             # This file
└── commands/             # Slash command definitions (installed to .claude/commands/)
    ├── todo-list.md      # /todo-list command
    ├── todo-add.md       # /todo-add command
    ├── todo-remove.md    # /todo-remove command
    └── todo-clear.md     # /todo-clear command

.project-todos.json       # Data file (gitignored)
.mcp.json                 # MCP configuration (created by install.sh)
```

**Note**: Slash commands are defined in `commands/` within the project and automatically installed to `.claude/commands/` by the install script.

## Dependencies

- `@modelcontextprotocol/sdk` ^1.0.4 - MCP server framework
- `boxen` ^8.0.1 - Terminal box formatting

## Notes

- The `.project-todos.json` file should be gitignored (project-specific)
- Slash commands use absolute paths for reliability
- Both interfaces share the same underlying code (`lib.js`)
- The CLI tool provides immediate feedback with colored output
- The MCP server provides simple text responses suitable for Claude
