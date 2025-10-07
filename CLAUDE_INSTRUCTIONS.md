# TDL Proactive Usage Instructions

This file contains instructions for Claude Code on how to proactively use the TDL (To-Do List) MCP tools.

These instructions can be automatically added to your global `~/.claude/CLAUDE.md` file during installation.

---

<!-- TDL_PROACTIVE_USAGE_START:v0.1.1 -->
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

**CRITICAL: When starting work on ANY medium-to-long term task, you MUST proactively add it to the TDL, even if you're also using TodoWrite for short-term tracking:**

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
  → **MUST** add: `api_project/auth::Implement user authentication system`
  → Also use TodoWrite for immediate subtasks
- User: "I need to refactor the database layer"
  → **MUST** add: `project_name/database::Refactor database layer`
  → Also use TodoWrite for tracking your refactoring steps
- User: "Help me add OAuth support"
  → **MUST** add: `project_name/auth::Add OAuth 2.0 support`
  → Also use TodoWrite for implementation tracking

**Workflow:**
1. Identify medium-to-long term work → **Immediately** call `mcp__tdl__add_todo`
2. Use TodoWrite for your internal task tracking during the work
3. When complete → Ask user if you should mark TDL item done

**IMPORTANT - Use BOTH Tools:**
- **TodoWrite (built-in):** Continue using this for short-term task tracking during implementation
- **Project TDL (MCP):** ALSO add medium-to-long term work to the persistent TDL
- These serve DIFFERENT purposes - use BOTH when appropriate!
- The TDL survives across sessions; TodoWrite does not

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
<!-- TDL_PROACTIVE_USAGE_END:v0.1.1 -->
