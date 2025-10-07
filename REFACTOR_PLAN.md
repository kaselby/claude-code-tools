# TDL Refactoring Plan: Global-Only Storage

## Overview

Simplify the TDL architecture to use **global-only storage** with **scope as a view filter**. This eliminates the need for sync logic, dual storage, and conflict resolution while maintaining all essential functionality.

## Core Design Changes

### Before (Dual Storage + Sync)
```
Storage:
  - .project-todos.json (project-specific, gitignored)
  - ~/.tdl/.global-todos.json (global, user-wide)
  - Sync system to keep them in sync

Scope: Controls WHERE to store
  - scope="local" → write to .project-todos.json
  - scope="global" → write to ~/.tdl/.global-todos.json
  - scope="both" → write to both + sync
```

### After (Global-Only + Filter)
```
Storage:
  - ~/.tdl/.global-todos.json (ONLY storage location)
  - ~/.tdl/.global-todos-history.json (ONLY history location)

Scope: Controls WHAT to display
  - scope="project" → filter by current project, show matching todos
  - scope="global" → show all todos
```

## Key Architectural Changes

### 1. Storage Simplification

**Remove:**
- `.project-todos.json` (project root)
- `.project-todos-history.json` (project root)
- All `scope` parameters from read/write functions
- `getTodoFilePathForScope()` function
- `getHistoryFilePathForScope()` function

**Keep:**
- `~/.tdl/.global-todos.json` (rename to `.todos.json`)
- `~/.tdl/.global-todos-history.json` (rename to `.todos-history.json`)

**Update:**
```javascript
// lib.js

// Before:
export async function readTodos(scope = null) {
  const filePath = scope ? getTodoFilePathForScope(scope) : await getTodoFilePath();
  // ...
}

// After:
export async function readTodos(filterByProject = false) {
  const filePath = path.join(CONFIG_DIR, TODO_FILE);
  let todos = JSON.parse(await fs.readFile(filePath));

  // Apply project filter if requested
  if (filterByProject) {
    const projectName = await detectProjectName();
    todos = todos.filter(t => t.category === projectName);
  }

  return todos;
}
```

### 2. Project Name Auto-Detection

**Implement in lib.js:**
```javascript
/**
 * Detect the current project name for filtering and categorization
 * @returns {Promise<string|null>} Project name or null if not in a project
 */
export async function detectProjectName() {
  try {
    // Try git repo name first
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync('git', [
      'rev-parse',
      '--show-toplevel'
    ]);

    const repoPath = stdout.trim();
    return path.basename(repoPath);
  } catch (error) {
    // Not a git repo or git not available
    // Use current directory name as fallback
    const cwd = process.cwd();
    const basename = path.basename(cwd);

    // Don't use generic names like "src", "test", "home"
    const genericNames = ['src', 'test', 'tests', 'dist', 'build', 'home'];
    if (genericNames.includes(basename.toLowerCase())) {
      return null;
    }

    return basename;
  }
}
```

### 3. Adding Todos with Auto-Categorization

**Update `addTodo()` in lib.js:**
```javascript
/**
 * Add a todo to global storage with optional auto-categorization
 * @param {string} taskString - Task string, optionally with category prefix
 * @param {Object} options - Options
 * @param {boolean} options.autoProject - Auto-prepend project name (default: true)
 * @param {string} options.projectOverride - Explicit project name to use
 * @returns {Promise<{todos: Array, added: Object}>}
 */
export async function addTodo(taskString, options = {}) {
  const { autoProject = true, projectOverride = null } = options;

  // Parse category using TodoCategory (supports up to 3 levels now)
  const todoCategory = TodoCategory.fromString(taskString, 3);

  // Auto-prepend project name if:
  // 1. autoProject is enabled
  // 2. We're in a project context
  // 3. Task doesn't already have a category
  let finalCategory = todoCategory;

  if (autoProject && todoCategory.depth === 0) {
    const projectName = projectOverride || await detectProjectName();
    if (projectName) {
      finalCategory = new TodoCategory([projectName], todoCategory.task);
    }
  }

  // If autoProject and we have a 1-level category, prepend project
  if (autoProject && todoCategory.depth === 1) {
    const projectName = projectOverride || await detectProjectName();
    if (projectName) {
      finalCategory = todoCategory.toGlobalCategory(projectName);
    }
  }

  const todos = await readTodos();
  const newTodo = {
    ...finalCategory.toStorageV1(3),
    added: new Date().toISOString(),
  };
  todos.push(newTodo);
  await writeTodos(todos);

  return { todos, added: newTodo };
}
```

### 4. Scope Configuration

**Update config.js:**
```javascript
// Before:
const DEFAULT_CONFIG = {
  colorProfile: "default",
  scope: "project", // Controls storage AND display
  defaultAddScope: "local",
};

// After:
const DEFAULT_CONFIG = {
  colorProfile: "default",
  scope: "project", // Controls display filtering only
  // Remove defaultAddScope - all adds go to global now
};

/**
 * Get the current scope setting (project or global)
 * This controls which todos are DISPLAYED, not where they're stored.
 *
 * @returns {Promise<string>} "project" or "global"
 */
export async function getScope() {
  const config = await readConfig();
  return config.scope || "project";
}
```

### 5. Category Depth Update

**Update config.js:**
```javascript
// Before:
export const CATEGORY_DEPTH = {
  local: 1,   // Local scope: 1 level
  global: 2   // Global scope: 2 levels
};

// After:
export const CATEGORY_DEPTH = {
  max: 3   // All todos support up to 3 levels: project/area/subarea
};

// Or keep it simple:
export const MAX_CATEGORY_DEPTH = 3;
```

### 6. MCP Tool Updates

**Update index.js:**
```javascript
// Before:
{
  name: "add_todo",
  description: "Add a todo with optional category. " +
    "Format: 'category::task' or 'category/subcategory::task'.",
  inputSchema: {
    type: "object",
    properties: {
      task: { type: "string", description: "Task with optional category" },
      scope: {
        type: "string",
        enum: ["local", "global", "both"],
        description: "Where to add: local project, global, or both"
      }
    },
    required: ["task"]
  }
}

// After:
{
  name: "add_todo",
  description: "Add a todo to global storage with optional auto-categorization. " +
    "Format: 'category::task' or 'category/subcategory::task'. " +
    "When called from a project directory, automatically prepends project name " +
    "unless task already has a category. " +
    "Examples: " +
    "'Add feature' → 'myproject::Add feature' (auto), " +
    "'backend::Fix bug' → 'myproject/backend::Fix bug' (auto), " +
    "'otherproject/api::Task' → 'otherproject/api::Task' (explicit)",
  inputSchema: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Task with optional category prefix (supports up to 3 levels)"
      },
      autoProject: {
        type: "boolean",
        description: "Auto-prepend current project name (default: true)"
      },
      projectOverride: {
        type: "string",
        description: "Explicit project name to use instead of auto-detection"
      }
    },
    required: ["task"]
  }
}
```

**Update query tools:**
```javascript
{
  name: "get_todos",
  description: "Get raw todo data with optional filtering. " +
    "All todos are stored globally. Use filters to view specific subsets.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", description: "Filter by first-level category" },
      subcategory: { type: "string", description: "Filter by second-level category" },
      untagged: { type: "boolean", description: "Only show untagged todos" },
      currentProject: {
        type: "boolean",
        description: "Filter by current project (auto-detected from git/directory)"
      },
      // ... other filters
    }
  }
}
```

### 7. CLI Updates

**Update cli.js:**
```javascript
// Before:
case "add": {
  const taskString = args.slice(1).join(" ");
  const scope = getScopeFlag(args); // --scope local|global|both
  const result = await addTodo(taskString, scope);
  // ...
}

// After:
case "add": {
  const taskString = args.slice(1).join(" ");

  // Parse flags
  const noAuto = args.includes('--no-auto');
  const projectFlag = args.find(arg => arg.startsWith('--project='));
  const projectOverride = projectFlag ? projectFlag.split('=')[1] : null;

  const result = await addTodo(taskString, {
    autoProject: !noAuto,
    projectOverride
  });

  console.log(`✓ Added: ${result.added.task}`);
  if (result.added.category) {
    const cat = TodoCategory.fromStorage(result.added);
    console.log(`  Category: ${cat.toString()}`);
  }
}
```

**Update list command:**
```javascript
case "list": {
  const categoryArg = args[1];
  const scope = await getScope();

  // Read todos with optional project filtering
  const filterByProject = (scope === "project");
  let todos = await readTodos();

  // Apply project filter if scope is "project"
  if (filterByProject) {
    const projectName = await detectProjectName();
    if (projectName) {
      todos = todos.filter(t => t.category === projectName);
    }
  }

  // Apply category filter if provided
  if (categoryArg) {
    todos = await filterTodos({ category: categoryArg });
  }

  // Add indices and display
  todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
  const formatted = await formatTodoList(todos, categoryArg);
  console.log(formatted);
}
```

## Migration Strategy

### Phase 1: Data Migration Script

Create `migrate.js`:
```javascript
#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { CONFIG_DIR } from "./config.js";
import { detectProjectName } from "./lib.js";

async function migrate() {
  console.log("🔄 Migrating TDL to global-only storage...\n");

  // 1. Check for existing project todos
  const projectTodosPath = path.join(process.cwd(), ".project-todos.json");
  const projectHistoryPath = path.join(process.cwd(), ".project-todos-history.json");

  let projectTodos = [];
  let projectHistory = { completed: [] };

  try {
    projectTodos = JSON.parse(await fs.readFile(projectTodosPath, "utf-8"));
    console.log(`✓ Found ${projectTodos.length} project todos`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    projectHistory = JSON.parse(await fs.readFile(projectHistoryPath, "utf-8"));
    console.log(`✓ Found ${projectHistory.completed?.length || 0} completed todos`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // 2. Load existing global todos
  const globalTodosPath = path.join(CONFIG_DIR, ".global-todos.json");
  const globalHistoryPath = path.join(CONFIG_DIR, ".global-todos-history.json");

  let globalTodos = [];
  let globalHistory = { completed: [], lastCleared: new Date().toISOString() };

  try {
    globalTodos = JSON.parse(await fs.readFile(globalTodosPath, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    globalHistory = JSON.parse(await fs.readFile(globalHistoryPath, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // 3. Migrate project todos to global with project prefix
  if (projectTodos.length > 0) {
    const projectName = await detectProjectName();
    console.log(`\n📦 Migrating project todos to global with prefix: ${projectName}`);

    for (const todo of projectTodos) {
      // Transform: category → projectName/category
      const migrated = {
        ...todo,
        subcategory: todo.category,
        category: projectName
      };
      globalTodos.push(migrated);
    }

    console.log(`✓ Migrated ${projectTodos.length} todos`);
  }

  // 4. Migrate history
  if (projectHistory.completed?.length > 0) {
    const projectName = await detectProjectName();

    for (const todo of projectHistory.completed) {
      const migrated = {
        ...todo,
        subcategory: todo.category,
        category: projectName
      };
      globalHistory.completed.push(migrated);
    }

    console.log(`✓ Migrated ${projectHistory.completed.length} completed todos`);
  }

  // 5. Write merged global todos
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(globalTodosPath, JSON.stringify(globalTodos, null, 2));
  await fs.writeFile(globalHistoryPath, JSON.stringify(globalHistory, null, 2));

  console.log(`\n✓ Wrote ${globalTodos.length} todos to global storage`);

  // 6. Backup and remove old files
  if (projectTodos.length > 0) {
    const backupPath = projectTodosPath + ".backup";
    await fs.copyFile(projectTodosPath, backupPath);
    await fs.unlink(projectTodosPath);
    console.log(`\n✓ Backed up project todos to: ${backupPath}`);
    console.log(`✓ Removed: ${projectTodosPath}`);
  }

  if (projectHistory.completed?.length > 0) {
    const backupPath = projectHistoryPath + ".backup";
    await fs.copyFile(projectHistoryPath, backupPath);
    await fs.unlink(projectHistoryPath);
    console.log(`✓ Backed up project history to: ${backupPath}`);
    console.log(`✓ Removed: ${projectHistoryPath}`);
  }

  console.log("\n✅ Migration complete!\n");
  console.log("Next steps:");
  console.log("  1. Test with: node cli.js list");
  console.log("  2. Verify todos are displayed correctly");
  console.log("  3. Remove backup files when satisfied");
}

migrate().catch(error => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
```

### Phase 2: Code Refactoring Checklist

**lib.js:**
- [ ] Remove `getTodoFilePathForScope()`, `getHistoryFilePathForScope()`
- [ ] Update `getTodoFilePath()` to always return global path
- [ ] Update `getHistoryFilePath()` to always return global path
- [ ] Remove `scope` parameter from `readTodos()`, `writeTodos()`
- [ ] Add `filterByProject` parameter to `readTodos()`
- [ ] Implement `detectProjectName()` function
- [ ] Update `addTodo()` to auto-categorize with project name
- [ ] Remove `addToBoth()` function (no longer needed)
- [ ] Update file path constants (remove "global" prefix)

**config.js:**
- [ ] Update `CATEGORY_DEPTH` to single `max: 3`
- [ ] Remove `defaultAddScope` from config schema
- [ ] Update `getScope()` documentation to clarify it's for filtering

**category.js:**
- [ ] Update `fromString()` to accept `maxDepth = 3` as default
- [ ] No major changes needed (already flexible!)

**index.js (MCP):**
- [ ] Update `add_todo` tool: remove `scope` param, add `autoProject` and `projectOverride`
- [ ] Update `get_todos` tool: add `currentProject` filter option
- [ ] Update all tool descriptions to reflect global-only storage
- [ ] Update examples in tool descriptions

**cli.js:**
- [ ] Update `add` command: remove `--scope` flag, add `--no-auto` and `--project=` flags
- [ ] Update `list` command: apply project filter when `config.scope = "project"`
- [ ] Update help text
- [ ] Add note about global-only storage

**Documentation:**
- [ ] Update CLAUDE.md to reflect global-only architecture
- [ ] Remove references to "local scope", "project scope" as storage
- [ ] Update examples to show project filtering
- [ ] Delete SYNC_DESIGN.md (no longer relevant)
- [ ] Update ENHANCEMENT_PLAN.md or delete it
- [ ] Create MIGRATION.md with upgrade instructions

### Phase 3: Testing

**Test scenarios:**
1. Fresh install (no existing todos)
   - Add todo with auto-project
   - Verify project name is prepended
   - Toggle scope to see filtered vs all

2. Migration from dual storage
   - Run migration script
   - Verify todos are preserved
   - Verify project prefix is added
   - Verify no duplicates

3. Category formats
   - Add untagged: "Do something" → "projectname::Do something"
   - Add 1-level: "backend::Fix bug" → "projectname/backend::Fix bug"
   - Add 2-level: "other/api::Task" → "other/api::Task" (no change)

4. Project detection
   - Test in git repo (should use repo name)
   - Test in non-git directory (should use directory name)
   - Test with `--project=` override

5. Filtering
   - Set scope to "project", verify only current project shown
   - Set scope to "global", verify all projects shown
   - Use category filter with project scope

6. Complete workflow
   - Add todos from multiple projects
   - Complete some todos
   - Check history
   - Restore from history

## Benefits Summary

### Code Reduction
- **Remove:** ~500 lines of sync logic (SYNC_DESIGN.md implementation)
- **Remove:** Dual storage file management
- **Remove:** `scope` parameter threading through all functions
- **Add:** ~50 lines for project detection and filtering
- **Net:** ~450 lines of code eliminated

### Maintenance Reduction
- No sync conflicts
- No data consistency issues
- Single source of truth
- Simpler debugging
- Fewer edge cases

### Functionality Preserved
- ✓ Project-specific view (via filtering)
- ✓ Global view (show all)
- ✓ Category hierarchy (now 3 levels)
- ✓ Auto-categorization by project
- ✓ Color profiles
- ✓ History and completion
- ✓ Bulk operations

### New Capabilities
- Can see todos across ALL projects in one view
- Easier to move todos between projects (just change category)
- No "out of sync" issues
- Simpler mental model

## Rollout Plan

1. **Create feature branch:** `git checkout -b refactor/global-only-storage`

2. **Implement changes:**
   - Start with lib.js (core logic)
   - Update config.js
   - Update cli.js
   - Update index.js (MCP)
   - Create migration script

3. **Test thoroughly:**
   - Run migration script on test data
   - Test all CLI commands
   - Test all MCP tools from Claude
   - Verify no data loss

4. **Update documentation:**
   - CLAUDE.md
   - README if exists
   - Installation instructions
   - Migration guide

5. **Release:**
   - Merge to main
   - Tag version (e.g., v2.0.0 - breaking change)
   - Run `./install.sh` to update global installation
   - Provide migration instructions for existing users

## Breaking Changes

**Note: Currently at v2.0.0 pre-release, so this refactor is part of the initial release.**

Changes in this refactor:
- Project-local `.project-todos.json` files will be migrated and removed
- `scope` parameter changes from "where to store" to "what to show"
- MCP tool signatures change (`scope` → `autoProject`/`projectOverride`)
- Existing scripts using `--scope local|global|both` flags must be updated

**Migration path provided:**
- Run `node migrate.js` to convert existing todos
- Old files backed up with `.backup` extension
- Can roll back by restoring backups if needed
