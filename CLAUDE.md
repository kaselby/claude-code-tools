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

The TDL tool uses a **global-only storage** architecture with smart filtering:

### Core Concepts

**Storage**: All todos are stored globally in `~/.tdl/todos.json` regardless of which project you're in.

**Scope**: Controls which todos are DISPLAYED, not where they're stored:
- `scope="project"` → Show only current project's todos (filtered by project name)
- `scope="global"` → Show todos from all projects (no filtering)

**Auto-categorization**: When adding todos from a project directory, the project name is automatically prepended as the first-level category unless the task already has explicit categories.

### Core Components

1. **`lib.js`**: Shared business logic
   - File operations: `readTodos()`, `writeTodos()`, `getTodoFilePath()`
   - Project detection: `detectProjectName()` - auto-detects project from git repo or directory name
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

4. **`config.js`**: Configuration management
   - Color profiles for terminal display
   - Scope setting (project vs global view)
   - Category depth limit (currently 3 levels max)

5. **`category.js`**: Category abstraction layer
   - Parses category strings (`cat/subcat::task`)
   - Handles category transformations for auto-project prefixing
   - Future-proof for deeper category nesting

6. **Slash Commands** (`commands/`):
   - `/tdl-list [category]` - Display todos with optional category filter
   - `/tdl-add <task>` - Add todo (supports `cat/subcat::task` format)
   - `/tdl-remove <num>` - Remove todo by index
   - `/tdl-clear` - Clear todos (respects scope setting)
   - All commands use `/t` directive to disable thinking mode for fast execution

### Data Model

**Global Storage**: `~/.tdl/todos.json`

```json
[
  {
    "task": "Task description",
    "category": "project-name",           // First-level: usually project name
    "subcategory": "area-name",           // Second-level: feature area (optional)
    "added": "2025-10-07T13:00:00.000Z"
  }
]
```

**Category Levels** (max 3):
1. **Project name** (auto-added if in project directory)
2. **Feature area** (e.g., "backend", "frontend", "docs")
3. **Sub-area** (e.g., "api", "database") - future expansion

**Examples**:
- `"Fix bug"` → Auto becomes `"tdl::Fix bug"` (project name prepended)
- `"backend::Optimize queries"` → Auto becomes `"tdl/backend::Optimize queries"`
- `"otherproject/api::Add endpoint"` → Stays as-is (explicit project specified)

### MCP Tools Available

The MCP server exposes 12 consolidated tools to Claude (prefixed with `mcp__tdl__`):

**Modification Tools** (accept single ID, array of IDs, or filter criteria):
- `add_todos` - Add one or more todos with auto-categorization
  - Accepts: single string, array of strings, or array of objects
  - Parameters: `tasks` (required), `autoProject` (default: true), `projectOverride` (optional)
  - Examples: `"Fix bug"`, `["Fix bug", "Add test"]`, `[{task: "Fix bug", autoProject: false}]`

- `remove_todos` - Permanently remove one or more todos (no history)
  - Accepts: `{ id: "uuid" }`, `{ ids: ["uuid1", "uuid2"] }`, or `{ filter: {...} }`
  - Filter by: category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText

- `complete_todos` - Mark one or more todos as complete (moves to history)
  - Accepts: `{ id: "uuid" }`, `{ ids: ["uuid1", "uuid2"] }`, or `{ filter: {...} }`
  - History viewable until midnight, then auto-clears

- `update_todos` - Update one or more todos' text and/or categories
  - Accepts: `{ id: "uuid", updates: {...} }`, `{ ids: [...], updates: {...} }`, or `{ filter: {...}, updates: {...} }`
  - Updates: task, category, subcategory (use null to remove)

- `restore_todos` - Restore one or more completed todos from history
  - Accepts: `{ id: "uuid" }`, `{ ids: ["uuid1", "uuid2"] }`, or `{ filter: {...} }`
  - Can filter history by category, subcategory, searchText, etc.

- `clear_todos` - Clear all todos (respects scope setting)
  - Clears current project or all projects based on scope

**Query Tools**:
- `query_todos` - Get raw JSON data with optional metadata
  - All filter options: category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText
  - Set `includeMetadata: true` to include categories, stats, and current project info
  - Use this to silently check if tasks exist without displaying to user

- `display_todos` - Pretty-printed formatted list for user display
  - Respects scope setting (project or global view)
  - Includes ID mapping for Claude in HTML comment
  - Use after modifications to show updated list

- `query_history` - View completed todos from today
  - Respects scope setting
  - History clears automatically at midnight

**Configuration Tools**:
- `get_config` - Get current configuration (color profile, scope setting, current project)
- `set_color_profile` - Change display colors (default, ocean, forest, sunset, purple, monochrome)
- `set_scope` - Change display filter (project or global view)

**Usage Patterns**:
- All modification tools accept flexible parameters: single ID, array of IDs, or filter criteria
- Use `query_todos` to silently inspect todos without displaying to user
- Use `display_todos` after modifications to show formatted list to user
- Filter operations work consistently across all tools
- All todos stored globally but filtered by scope setting for display

### Auto-Categorization Behavior

**When adding todos:**

1. **Untagged task** (`"Fix bug"`):
   - If in project directory → prepends project name: `[projectname] Fix bug`
   - If not in project or project unknown → stored as-is (untagged)

2. **1-level category** (`"backend::Fix bug"`):
   - If in project directory → adds project as first level: `[projectname/backend] Fix bug`
   - If not in project → stored as-is: `[backend] Fix bug`

3. **2+ level categories** (`"otherproject/api::Add endpoint"`):
   - No auto-categorization (explicit project specified)
   - Stored exactly as specified

**Override flags:**
- `autoProject: false` - Disable auto-project prefixing
- `projectOverride: "name"` - Use specific project name instead of auto-detection

### History & Completion

**Completion vs Removal**:
- **Complete** (`complete_todos`): Marks task(s) as done, moves to history for today
- **Remove** (`remove_todos`): Permanently deletes without saving to history

**History Features**:
- Completed tasks stored in `~/.tdl/todos-history.json` (global)
- View today's completed tasks with `query_history`
- Restore accidentally completed tasks with `restore_todos`
- History automatically clears at midnight (lazy clearing on first operation of new day)
- History respects scope setting (can view current project's completions or all)
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

### Migration from Old Architecture

If upgrading from the old dual-storage architecture (project-local + global):

```bash
cd mcp-tools/tdl
node migrate.js
```

The migration script:
1. Finds project-local `.project-todos.json` files
2. Transforms todos by prepending project name as category
3. Merges into global storage (`~/.tdl/todos.json`)
4. Backs up and removes old files
5. Handles both active todos and history

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
node cli.js list                          # Show todos (respects scope setting)
node cli.js add "Test task"               # Auto-adds project name
node cli.js add "backend::Fix database"   # Auto-adds as tdl/backend
node cli.js add "other/api::Task" --no-auto  # No auto-categorization
node cli.js remove 1
node cli.js complete 1
node cli.js history
node cli.js config show                   # Show current configuration
node cli.js config scope global           # Switch to global view
node cli.js clear                         # Clear (respects scope)

# Test via slash commands (in Claude Code)
/tdl-list                      # Show current project todos
/tdl-add Test task             # Add with auto-categorization
/tdl-add backend::Fix bug      # Add with category
/tdl-remove 1
/tdl-clear
```

## Key Design Patterns

### Global-Only Storage with Smart Filtering

All todos are stored in one place (`~/.tdl/todos.json`), but the scope setting controls which todos are displayed:
- Simple mental model: one source of truth
- No sync conflicts or data consistency issues
- Easy to see todos across all projects or just current project
- Project detection is automatic (git repo name or directory name)

### Dual Interface Architecture

The tool provides two ways to interact with the same data:
- **MCP Tools**: For Claude to manage todos programmatically during conversations
- **Slash Commands**: For users to manage todos directly with immediate execution

Both interfaces use the same `lib.js` functions, ensuring consistency.

### Auto-Categorization

When Claude adds todos through MCP or users add via CLI:
- Detects current project context (git repo or directory)
- Automatically prepends project name to organize todos
- Can be disabled with `autoProject: false` flag
- Works intelligently: doesn't add project if explicit 2+ level category provided

### Category Abstraction Layer

The `TodoCategory` class provides a future-proof abstraction:
- Currently uses `{category, subcategory}` storage format (2 levels)
- Supports up to 3 category levels in the data model
- Easy to expand to deeper nesting in future without breaking changes
- Handles category transformations for auto-project prefixing

### Slash Command Implementation

Slash commands are Markdown files in `.claude/commands/` with YAML frontmatter:

```markdown
---
description: Command description
tools: [mcp__tdl__query_todos]  # Optional: MCP tools to use
args:
  - name: category
    required: false
---

/t  # Disable thinking mode for fast execution

Command instructions for Claude...
```

Commands can:
- Execute shell commands with `!` prefix: `!node cli.js list`
- Call MCP tools directly: `tools: [mcp__tdl__query_todos]`
- Accept arguments that get passed to the command

### Thinking Mode Control

Slash commands use `/t` directive to disable Claude's thinking mode for faster execution. This is appropriate for simple operations like listing or adding todos where extended reasoning isn't needed.

## File Locations

- **Todo data**: `~/.tdl/todos.json` (global storage)
- **History data**: `~/.tdl/todos-history.json` (global storage)
- **Configuration**: `~/.tdl/config.json` (color profile, scope setting)
- **MCP server config**: `~/.claude/mcp-config.json` (user scope)
- **Tool approval config**: `~/.claude/config.json`
- **Slash commands**: `~/.claude/commands/tdl-*.md`
- **Project settings**: `.claude/settings.local.json` (auto-approval permissions)

## Important Notes

- All todos are stored globally in `~/.tdl/` regardless of which project you're in
- The `scope` setting controls display filtering, not storage location
- Project names are auto-detected from git repo name or directory name
- Slash commands use absolute paths for reliability
- The installer optionally configures auto-approval to avoid tool approval prompts
- All MCP tools follow the naming convention `mcp__tdl__*`
- The tool uses `boxen` for terminal formatting in CLI/slash commands but returns plain text from MCP tools
- Categories are displayed with color-coded format: `[category/subcategory]` where category is magenta and subcategory is cyan
- Maximum category depth is 3 levels (configurable in `config.js`)

## Migration Notes

**Old architecture** (pre-v2.0.0):
- Project-local storage: `.project-todos.json` in each project root
- Global storage: `~/.tdl/.global-todos.json`
- Dual storage required sync operations

**New architecture** (v2.0.0+):
- Global-only storage: `~/.tdl/todos.json`
- Scope setting controls display filtering
- No sync needed, simpler and more reliable
- Run `node migrate.js` to convert old todos

## Troubleshooting

**Q: Where are my todos stored?**
A: All todos are in `~/.tdl/todos.json` regardless of project.

**Q: Why don't I see todos I just added?**
A: Check your scope setting with `node cli.js config show`. If scope is "project", you only see current project's todos. Switch to "global" to see all: `node cli.js config scope global`

**Q: How do I prevent auto-categorization?**
A: Use `--no-auto` flag: `node cli.js add "Task" --no-auto` or set `autoProject: false` in MCP tool call.

**Q: Can I use this across multiple machines?**
A: Yes! Since all data is in `~/.tdl/`, you can sync this directory (e.g., with Dropbox, iCloud, or git) to share todos across machines.
