# TDL - Project To-Do List for Claude Code

**A lightweight, project-specific to-do list system with MCP tools and slash commands for Claude Code.**

## What is TDL?

TDL (To-Do List) is a dual-interface task management system designed specifically for Claude Code workflows:

- **MCP Tools**: Allow Claude to proactively manage todos during conversations
- **Slash Commands**: Give you direct control via simple terminal commands
- **Project-Scoped**: Each project has its own `.project-todos.json` file (gitignored)
- **Persistent**: Track long-term tasks across Claude Code sessions

## Features

✅ **Dual Interface** - MCP tools for Claude, slash commands for you
📂 **Project-Specific** - Separate todo lists per project
🏷️ **Categories & Subcategories** - Organize with `category/subcategory::task` syntax
📊 **Filtering** - Query by category, date range, or search text
📜 **History** - View completed tasks from today (auto-clears at midnight)
🔄 **Restore** - Undo accidental completions from history
⚡ **Fast** - Uses `/t` directive for instant slash command execution

## Installation

```bash
# Run installer
./install.sh
```

The installer will:
1. Install npm dependencies
2. Register MCP server with Claude Code
3. Install slash commands to `~/.claude/commands/`
4. Optionally configure auto-approval for TDL MCP tools
5. Optionally add proactive usage instructions to `~/.claude/CLAUDE.md`

**Restart Claude Code** after installation to load the MCP server.

## Usage

### Slash Commands (Direct User Control)

```bash
# List all todos
/tdl

# List todos in a specific category
/tdl backend

# Add a todo
/tdl-add Fix authentication bug

# Add with category
/tdl-add backend::Fix database connection

# Add with category and subcategory
/tdl-add backend/api::Add rate limiting

# Complete a todo (moves to history)
/tdl-check 3

# View today's completed tasks
/tdl-history

# Restore a completed task
/tdl-restore 2

# Remove a todo permanently
/tdl-remove 5

# Clear all todos
/tdl-clear
```

### MCP Tools (Claude's Interface)

Claude has access to these tools (prefixed with `mcp__tdl__`):

**Query Tools:**
- `get_todos` - Get raw JSON data (supports all filters)
- `display_todos` - Pretty-printed list for user display
- `get_metadata` - Get categories and statistics
- `query_history` - View completed tasks from today

**Modification Tools:**
- `add_todo` - Add tasks
- `complete_todo` - Mark as done (moves to history)
- `remove_todo` - Delete permanently (no history)
- `update_todo` - Update task text/category/subcategory
- `bulk_update` - Update multiple todos matching filters
- `bulk_delete` - Delete multiple todos matching filters
- `restore_todo` - Restore from history
- `clear_todos` - Clear all todos

### Proactive Usage

If you enabled proactive usage instructions during installation, Claude will:
- ✅ Automatically display the list after modifications
- ✅ Proactively add medium-to-long term tasks you're working on
- ✅ Ask if completed tasks should be checked off

## Category System

Organize todos with optional categories and subcategories:

```bash
# Simple category
/tdl-add backend::Refactor database layer

# Hierarchical organization
/tdl-add backend/api::Add rate limiting
/tdl-add backend/db::Optimize queries
/tdl-add frontend/auth::Add OAuth support

# Filter by category
/tdl backend                    # Shows all backend/* tasks
```

Categories are displayed with color-coded format: `[category/subcategory]`

## Data Storage

- **Active todos**: `.project-todos.json` (gitignored, in project root)
- **Today's history**: `.project-todos-history.json` (gitignored, auto-clears at midnight)

Example todo structure:
```json
{
  "task": "Add OAuth support",
  "category": "backend",
  "subcategory": "auth",
  "added": "2025-10-06T12:00:00.000Z"
}
```

## Uninstallation

```bash
./uninstall.sh
```

Removes:
- MCP server registration
- Slash commands from `~/.claude/commands/`

**Note:** Project todo files (`.project-todos.json`) are preserved.

## Related Projects

- [Claudebox](https://github.com/username/claudebox) - Isolated Docker sandbox for safe autonomous Claude Code sessions

## License

MIT License - See LICENSE file for details
