# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains custom MCP (Model Context Protocol) tools and subagents for Claude Code. The primary tool is a TDL (to-do list) system that provides both MCP tools for Claude and slash commands for direct user execution.

## Repository Structure

```
claude-code-tools/
├── mcp-tools/          # MCP tool implementations
│   └── tdl/            # Project TDL tool
├── subagents/          # Custom subagent definitions (currently empty)
└── .claude/            # Claude Code configuration
    ├── commands/       # Slash command definitions (installed by tools)
    └── settings.local.json
```

## Development Guidelines

**IMPORTANT**: During development, **NEVER** manually edit files in the global `~/.claude/` directory unless the user directly instructs you to. All changes to global Claude configuration (like `~/.claude/CLAUDE.md` or `~/.claude/commands/`) should only be applied by running the `install.sh` script.

- Keep all source files in the repository (`mcp-tools/tdl/`)
- Update `CLAUDE_INSTRUCTIONS.md` and `commands/*.md` in the repo
- Run `./install.sh` to propagate changes to `~/.claude/`
- This ensures version tracking and clean upgrades work correctly

## TDL MCP Tool Architecture

The TDL tool (`mcp-tools/tdl/`) uses a dual-interface architecture:

### Core Components

1. **`lib.js`**: Shared business logic used by both interfaces
   - File operations: `readTodos()`, `writeTodos()`, `getTodoFilePath()`
   - CRUD operations: `addTodo()`, `removeTodo()`, `updateTodo()`, `clearTodos()`
   - Query operations: `filterTodos()`, `getCategories()`, `getStats()`
   - Bulk operations: `bulkUpdate()`, `bulkDelete()`
   - Display formatting: `formatTodoList()` (uses `boxen` for colored terminal output)

2. **`index.js`**: MCP server implementation
   - Exposes tools for Claude to manage todos programmatically
   - Uses `@modelcontextprotocol/sdk` for MCP protocol
   - Registered as user-scoped MCP server via `claude mcp add`

3. **`cli.js`**: Command-line interface
   - Direct todo management via terminal: `node cli.js list|add|remove|clear`
   - Used by slash commands for immediate execution

4. **Slash Commands** (`commands/`):
   - `/tdl-list [category]` - Display todos with optional category filter
   - `/tdl-add <task>` - Add todo (supports `cat::task` or `cat/subcat::task` format)
   - `/tdl-remove <num>` - Remove todo by index
   - `/tdl-clear` - Clear all todos
   - All commands use `/t` directive to disable thinking mode for fast execution

### Data Model

Todos are stored in `.project-todos.json` (gitignored) at project root:

```json
[
  {
    "task": "Task description",
    "category": "category-name",     // or null
    "subcategory": "subcategory-name",  // or null
    "added": "2025-10-04T13:00:00.000Z"
  }
]
```

**Category & Subcategory Support**: Tasks can be organized using:
- `cat::task` format for simple categorization
- `cat/subcat::task` format for hierarchical organization
- Filtering by category and/or subcategory
- Listing untagged todos
- Category statistics and metadata queries
- Bulk operations on categories/subcategories

### MCP Tools Available

The MCP server exposes these tools to Claude (prefixed with `mcp__tdl__`):

**Query Tools**:
- `get_todos` - Get raw JSON data for silent inspection (supports all filters: category, subcategory, date range, text search, untagged)
- `display_todos` - Pretty-printed formatted list for user display (supports category and untagged filters only)
- `get_metadata` - Get categories and statistics
- `query_history` - View completed tasks from today

**Modification Tools**:
- `add_todo` - Add tasks (preserves user's wording closely, supports cat/subcat::task)
- `complete_todo` - Mark task as done and move to history (viewable until midnight)
- `remove_todo` - Permanently delete by 1-based index (no history)
- `update_todo` - Update task text and/or category and/or subcategory
- `bulk_update` - Update multiple todos matching filters
- `bulk_delete` - Delete multiple todos matching filters
- `restore_todo` - Restore completed task from history back to active
- `clear_todos` - Clear all todos

**Usage Patterns**:
- Use `get_todos` to silently check if tasks exist or query the list without displaying to the user
- Use `display_todos` after modifications to show the formatted list to the user
- `get_todos` supports advanced filtering (date ranges, text search), while `display_todos` is optimized for simple category filtering

### History & Completion

**Completion vs Removal**:
- **Complete** (`complete_todo`): Marks task as done, moves to history for today
- **Remove** (`remove_todo`): Permanently deletes without saving to history

**History Features**:
- Completed tasks stored in `.project-todos-history.json` (gitignored)
- View today's completed tasks with `query_history`
- Restore accidentally completed tasks with `restore_todo`
- History automatically clears at midnight (lazy clearing on first operation of new day)
- Helps track progress and provides undo capability

## Development Commands

### Installation

```bash
cd mcp-tools/tdl
./install.sh
```

The installer:
1. Runs `npm install` in the tool directory
2. Registers MCP server with `claude mcp add --scope user tdl`
3. Copies slash commands to `~/.claude/commands/`
4. Offers to configure auto-approval for tdl MCP tools in `~/.claude/config.json`

**Restart Claude Code after installation to load the MCP server.**

### Uninstallation

```bash
cd mcp-tools/tdl
./uninstall.sh
```

Removes the MCP server and slash commands.

### Testing the Tool

```bash
# Test CLI directly
cd mcp-tools/tdl
node cli.js list
node cli.js add "Test task"
node cli.js add "backend::Fix database"       # With category
node cli.js add "backend/api::Add endpoints"  # With category and subcategory
node cli.js remove 1
node cli.js clear

# Test via slash commands (in Claude Code)
/tdl-list
/tdl-list backend              # Filter by category
/tdl-add Test task
/tdl-add backend::Fix database
/tdl-add backend/api::Add endpoints
/tdl-remove 1
/tdl-clear
```

## Key Design Patterns

### Dual Interface Architecture

The tool provides two ways to interact with the same data:
- **MCP Tools**: For Claude to manage todos programmatically during conversations
- **Slash Commands**: For users to manage todos directly with immediate execution

Both interfaces use the same `lib.js` functions, ensuring consistency.

### Slash Command Implementation

Slash commands are Markdown files in `.claude/commands/` with YAML frontmatter:

```markdown
---
description: Command description
tools: [mcp__todo-list__query_todos]  # Optional: MCP tools to use
args:
  - name: category
    required: false
---

/t  # Disable thinking mode for fast execution

Command instructions for Claude...
```

Commands can:
- Execute shell commands with `!` prefix: `!`node cli.js list``
- Call MCP tools directly: `tools: [mcp__todo-list__query_todos]`
- Accept arguments that get passed to the command

### Category & Subcategory System

Categories and subcategories are optional metadata for organizing todos:
- Added using `cat::task` or `cat/subcat::task` format
- Subcategories provide hierarchical organization (e.g., `backend/api`, `backend/db`)
- Filterable via `query_todos` tool or `/tdl-list category` command
- Support bulk operations on all todos in a category/subcategory
- Query metadata for category list and statistics
- Display format: `[cat/subcat]` in magenta/cyan colors

### Thinking Mode Control

Slash commands use `/t` directive to disable Claude's thinking mode for faster execution. This is appropriate for simple operations like listing or adding todos where extended reasoning isn't needed.

## File Locations

- **Todo data**: `.project-todos.json` in project root (gitignored)
- **MCP server config**: `~/.claude/mcp-config.json` (user scope)
- **Tool approval config**: `~/.claude/config.json`
- **Slash commands**: `~/.claude/commands/tdl-*.md`
- **Project settings**: `.claude/settings.local.json` (auto-approval permissions)

## Important Notes

- The `.project-todos.json` file is project-specific and gitignored
- Slash commands use absolute paths for reliability
- The installer optionally configures auto-approval to avoid tool approval prompts
- All MCP tools follow the naming convention `mcp__tdl__*`
- The tool uses `boxen` for terminal formatting in CLI/slash commands but returns plain text from MCP tools
- Subcategories are displayed with color-coded format: `[category/subcategory]` where category is magenta and subcategory is cyan
