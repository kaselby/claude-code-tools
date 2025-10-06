# Project TDL (To-Do List)

A comprehensive todo list system for Claude Code that integrates both MCP tools (for Claude) and slash commands (for direct user execution).

## Features

- **Shared TDL**: Stored in `.project-todos.json` in the project root
- **Category & Subcategory Support**: Organize todos with `cat::task` or `cat/subcat::task` format
- **Completion History**: Track completed tasks throughout the day, auto-clears at midnight
- **Dual Interface**:
  - MCP tools for Claude to manage todos
  - Slash commands for immediate user execution
- **Beautiful Display**: Colored ANSI boxes (~45 chars wide) using `boxen`
- **Persistent**: Todos survive between Claude Code sessions
- **Undo Capability**: Restore accidentally completed tasks from history

## Architecture

### MCP Server (`index.js`)
Provides tools that Claude can use:
- `add_todo` - Add a task
- `complete_todo` - Mark task as complete (moves to history)
- `remove_todo` - Permanently remove a task (no history)
- `query_todos` - List/filter all tasks
- `query_history` - View completed tasks from today
- `restore_todo` - Restore a task from history
- `clear_todos` - Clear all tasks

### CLI Tool (`cli.js`)
Direct command-line interface:
```bash
node cli.js list                    # Show all todos
node cli.js add "Task description"  # Add a todo
node cli.js complete 3              # Mark todo #3 as complete
node cli.js remove 3                # Permanently remove todo #3
node cli.js history                 # Show completed tasks
node cli.js restore 1               # Restore task from history
node cli.js clear                   # Clear all todos
```

### Slash Commands
Seven commands installed in `.claude/commands/`:
- `/tdl-list [category]` - Display todos, optionally filtered by category
- `/tdl-add <task>` - Add a todo
- `/tdl-check <num>` - Mark a todo as complete (moves to history)
- `/tdl-remove <num>` - Permanently remove a todo (no history)
- `/tdl-history` - View completed tasks from today
- `/tdl-restore <num>` - Restore a task from history
- `/tdl-clear` - Clear all todos

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
# Show all todos
/tdl-list

# Show todos in a specific category
/tdl-list backend

# Add a todo
/tdl-add Implement authentication

# Add a todo with category
/tdl-add backend::Fix database connection

# Add a todo with category and subcategory
/tdl-add backend/api::Add rate limiting

# Remove todo #2
/tdl-remove 2

# Clear all todos
/tdl-clear
```

Slash commands execute immediately without waiting for Claude.

### Using MCP Tools (Via Claude)

Talk to Claude:
- "Add 'Fix bug in parser' to the TDL"
- "Add 'backend/api::Implement rate limiting' to the TDL"
- "Show me the todos"
- "Show me todos in the backend category"
- "Remove item 3 from the TDL"
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
    "category": "backend",
    "subcategory": "auth",
    "added": "2025-10-04T13:00:00.000Z"
  },
  {
    "task": "Fix bug in parser",
    "category": "backend",
    "subcategory": null,
    "added": "2025-10-04T13:01:00.000Z"
  }
]
```

## File Structure

```
mcp-tools/tdl/
├── package.json          # Dependencies
├── index.js              # MCP server
├── cli.js                # CLI tool
├── lib.js                # Shared functions
├── install.sh            # Installation script
├── README.md             # This file
└── commands/             # Slash command definitions (installed to .claude/commands/)
    ├── tdl-list.md       # /tdl-list command
    ├── tdl-add.md        # /tdl-add command
    ├── tdl-remove.md     # /tdl-remove command
    └── tdl-clear.md      # /tdl-clear command

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
- Categories and subcategories are optional - use `cat::task` or `cat/subcat::task` format when adding
