# TDL Proactive Usage Instructions

This file contains instructions for Claude Code on how to proactively use the TDL (To-Do List) MCP tools.

These instructions can be automatically added to your global `~/.claude/CLAUDE.md` file during installation.

---

<!-- TDL_PROACTIVE_USAGE_START:v0.1.0 -->
## Proactive TDL Usage Guidelines

Claude should automatically use TDL tools according to these rules:

### Display After Modifications

**After ANY modification to the todo list, automatically call `display_todos` to display the updated list**, unless:
- Multiple modifications are happening in sequence → only display after the final modification
- Context clearly suggests the user doesn't want to see the list

**Examples:**
- User: "Add task X" → Call `add_todo`, then `display_todos`
- User: "Add task X, Y, and Z" → Call `add_todo` three times, then `display_todos` once
- User: "Remove task 3" → Call `remove_todo`, then `display_todos`

### Adding Tasks for Long-Term Work

**When starting work on a medium-to-long term task, proactively add it to the TDL with appropriate categorization:**

**Category Format:** `project_name/feature::task description`
- **Category:** The overall project or repository name
- **Subcategory:** The specific feature, module, or area being worked on
- **Task:** Specific medium-to-long term goal

**What qualifies as TDL-worthy:**
- ✓ Medium-to-long term tasks for the user or shared work
- ✓ Tasks that span multiple sessions
- ✓ Feature implementations, bug fixes, refactoring projects
- ✓ Documentation or testing work that takes significant time
- ✗ Short-term subtasks Claude is tracking internally
- ✗ Immediate one-off operations

**Examples:**
- User: "Let's implement user authentication for the API"
  → Add: `api_project/auth::Implement user authentication system`
- User: "I need to refactor the database layer"
  → Add: `project_name/database::Refactor database layer`
- User: "Help me add OAuth support"
  → Add: `project_name/auth::Add OAuth 2.0 support`

**Note:** Claude should still use its own internal `TodoWrite` tool for short-term task tracking during implementation. The project TDL is for user-visible, persistent, medium-to-long term goals.

### Checking Off Completed Tasks

**When a task that exists on the TDL is completed, ask the user if it should be checked off:**

**Examples:**
- User: "The authentication is done"
  - Use `get_todos` to silently check if "authentication" task exists in TDL
  - If yes: "Great! Should I check off the authentication task from the TDL?"
  - Wait for confirmation, then call `complete_todo` and `display_todos`

- After implementing a feature that was on the TDL:
  - Use `get_todos` to verify the task exists
  - "I've finished implementing [feature]. This completes the '[task name]' task on your TDL. Should I mark it as complete?"

**Don't ask if:**
- The task clearly isn't complete yet
- The user is just providing a status update
- The completed work wasn't on the TDL

**Tool Usage:**
- Use `get_todos` to silently check if tasks exist without displaying to the user
- Use `display_todos` to show the formatted list after modifications
<!-- TDL_PROACTIVE_USAGE_END:v0.1.0 -->
