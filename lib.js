import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import boxen from "boxen";
import { getColorProfile, getScope, CONFIG_DIR, MAX_CATEGORY_DEPTH } from "./config.js";
import { TodoCategory } from "./category.js";

const execFileAsync = promisify(execFile);

// Global-only storage
const TODO_FILE = "todos.json";
const HISTORY_FILE = "todos-history.json";

/**
 * Get the path to the global todo file
 */
export function getTodoFilePath() {
  return path.join(CONFIG_DIR, TODO_FILE);
}

/**
 * Get the path to the global history file
 */
export function getHistoryFilePath() {
  return path.join(CONFIG_DIR, HISTORY_FILE);
}

/**
 * Detect the current project name for filtering and categorization
 * @returns {Promise<string|null>} Project name or null if not in a project
 */
export async function detectProjectName() {
  try {
    // Try git repo name first
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

    // Don't use generic names
    const genericNames = ['src', 'test', 'tests', 'dist', 'build', 'home', 'lib', 'bin'];
    if (genericNames.includes(basename.toLowerCase())) {
      return null;
    }

    return basename;
  }
}

/**
 * Read todos from global storage with optional project filtering
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Filter by current project
 * @param {string} options.projectName - Specific project to filter by
 * @returns {Promise<Array>} Array of todo objects
 */
export async function readTodos(options = {}) {
  try {
    const filePath = getTodoFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    let todos = JSON.parse(data);

    // Apply project filter if requested
    if (options.filterByProject) {
      const projectName = options.projectName || await detectProjectName();
      if (projectName) {
        todos = todos.filter(t => t.category === projectName);
      }
    }

    return todos;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Write todos to global storage
 * @param {Array} todos - Array of todo objects
 */
export async function writeTodos(todos) {
  const filePath = getTodoFilePath();

  // Ensure parent directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Atomic write: write to temp file first, then rename
  const tempFile = filePath + '.tmp';
  await fs.writeFile(tempFile, JSON.stringify(todos, null, 2), "utf-8");
  await fs.rename(tempFile, filePath);
}

/**
 * Read history from global storage
 * @returns {Promise<Object>} History object with completed array and lastCleared timestamp
 */
export async function readHistory() {
  try {
    const filePath = getHistoryFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { completed: [], lastCleared: new Date().toISOString() };
    }
    throw error;
  }
}

/**
 * Write history to global storage
 * @param {Object} history - History object with completed array and lastCleared timestamp
 */
export async function writeHistory(history) {
  const filePath = getHistoryFilePath();

  // Ensure parent directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Atomic write: write to temp file first, then rename
  const tempFile = filePath + '.tmp';
  await fs.writeFile(tempFile, JSON.stringify(history, null, 2), "utf-8");
  await fs.rename(tempFile, filePath);
}

/**
 * Check if it's a new day since lastCleared and clear history if so
 * @param {Object} history - History object
 * @returns {Object} Updated history (cleared if new day)
 */
function clearHistoryIfNewDay(history) {
  const now = new Date();
  const lastCleared = new Date(history.lastCleared);

  // Check if we're on a different day (comparing date strings YYYY-MM-DD)
  const nowDate = now.toLocaleDateString('en-CA'); // ISO format YYYY-MM-DD
  const lastDate = lastCleared.toLocaleDateString('en-CA');

  if (nowDate !== lastDate) {
    return {
      completed: [],
      lastCleared: now.toISOString()
    };
  }

  return history;
}

/**
 * Find a todo by its unique ID
 * @param {string} id - UUID of the todo
 * @param {Array} todos - Optional array of todos to search (defaults to reading from storage)
 * @returns {Promise<{todo: Object, index: number}>} The todo and its index, or null if not found
 */
export async function findTodoById(id, todos = null) {
  if (!todos) {
    todos = await readTodos();
  }

  const index = todos.findIndex(t => t.id === id);
  if (index === -1) {
    return null;
  }

  return { todo: todos[index], index };
}

/**
 * Add a todo to global storage with optional auto-categorization
 * @param {string} taskString - Task string, optionally with category prefix
 * @param {Object} options - Options
 * @param {boolean} options.autoProject - Auto-prepend project name (default: true)
 * @param {string} options.projectOverride - Explicit project name to use
 * @returns {Promise<{todos: Array, added: Object}>} Updated todos array and added todo
 * @throws {Error} If category depth exceeds limit
 */
export async function addTodo(taskString, options = {}) {
  const { autoProject = true, projectOverride = null } = options;

  // Parse category using TodoCategory (supports up to MAX_CATEGORY_DEPTH levels)
  const todoCategory = TodoCategory.fromString(taskString, MAX_CATEGORY_DEPTH);

  // Auto-prepend project name if:
  // 1. autoProject is enabled
  // 2. We're in a project context
  // 3. Task is untagged OR has only 1 level (which becomes 2nd level under project)
  let finalCategory = todoCategory;

  if (autoProject && (todoCategory.depth === 0 || todoCategory.depth === 1)) {
    const projectName = projectOverride || await detectProjectName();
    if (projectName) {
      finalCategory = todoCategory.toGlobalCategory(projectName);
    }
  }

  const todos = await readTodos();
  const newTodo = {
    id: randomUUID(),
    ...finalCategory.toStorageV1(MAX_CATEGORY_DEPTH),
    added: new Date().toISOString(),
  };
  todos.push(newTodo);
  await writeTodos(todos);

  return { todos, added: newTodo };
}

/**
 * Remove a todo by index (permanently delete, no history)
 * @param {number} index - 1-based index of the todo to remove
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Was list filtered by project?
 * @returns {Promise<{todos: Array, removed: Object}>} Updated todos array and the removed todo object
 * @throws {Error} If index is invalid
 */
export async function removeTodo(index, options = {}) {
  // Read with same filter as display to get correct indices
  const displayTodos = await readTodos(options);
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= displayTodos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${displayTodos.length}`);
  }

  const toRemove = displayTodos[arrayIndex];

  // Use the ID-based function for robustness
  if (!toRemove.id) {
    throw new Error("Todo does not have an ID. Run migration script.");
  }

  return await removeTodoById(toRemove.id);
}

/**
 * Complete a todo by index (move to history)
 * @param {number} index - 1-based index of the todo to complete
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Was list filtered by project?
 * @returns {Promise<{todos: Array, completed: Object}>} Updated todos array and the completed todo object
 * @throws {Error} If index is invalid
 */
export async function completeTodo(index, options = {}) {
  // Read with same filter as display to get correct indices
  const displayTodos = await readTodos(options);
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= displayTodos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${displayTodos.length}`);
  }

  const toComplete = displayTodos[arrayIndex];

  // Use the ID-based function for robustness
  if (!toComplete.id) {
    throw new Error("Todo does not have an ID. Run migration script.");
  }

  return await completeTodoById(toComplete.id);
}

/**
 * Clear all todos (or filtered subset)
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Clear only current project?
 * @returns {Promise<number>} Number of todos that were cleared
 */
export async function clearTodos(options = {}) {
  if (options.filterByProject) {
    // Clear only current project todos
    const projectName = await detectProjectName();
    const allTodos = await readTodos();
    const remaining = allTodos.filter(t => t.category !== projectName);
    const cleared = allTodos.length - remaining.length;
    await writeTodos(remaining);
    return cleared;
  } else {
    // Clear all todos
    const previousCount = (await readTodos()).length;
    await writeTodos([]);
    return previousCount;
  }
}

/**
 * Query history (completed todos from today)
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Filter by current project?
 * @returns {Promise<Array>} Array of completed todo objects with completedAt timestamps
 */
export async function queryHistory(options = {}) {
  let history = await readHistory();
  history = clearHistoryIfNewDay(history);

  // Save if we cleared
  if (history.completed.length === 0 && history.lastCleared) {
    await writeHistory(history);
  }

  let completed = history.completed;

  // Apply project filter if requested
  if (options.filterByProject) {
    const projectName = await detectProjectName();
    if (projectName) {
      completed = completed.filter(t => t.category === projectName);
    }
  }

  return completed;
}

/**
 * Restore a completed todo back to active list
 * @param {number} index - 1-based index in the history list
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Was history filtered by project?
 * @returns {Promise<{todos: Array, restored: Object}>} Updated todos array and the restored todo object
 * @throws {Error} If index is invalid
 */
export async function restoreTodo(index, options = {}) {
  // Read with same filter as display
  const displayHistory = await queryHistory(options);
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= displayHistory.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${displayHistory.length}`);
  }

  const toRestore = displayHistory[arrayIndex];

  // Use the ID-based function for robustness
  if (!toRestore.id) {
    throw new Error("Todo does not have an ID. Run migration script.");
  }

  return await restoreTodoById(toRestore.id);
}

/**
 * Filter todos based on various criteria
 * @param {Object} options - Filter options
 * @param {string} [options.category] - Filter by category (matches exact category)
 * @param {string} [options.subcategory] - Filter by subcategory (requires category to be set)
 * @param {boolean} [options.untagged] - Filter for todos without a category
 * @param {string} [options.dateFrom] - Filter todos added on or after this date (ISO string)
 * @param {string} [options.dateTo] - Filter todos added on or before this date (ISO string)
 * @param {string} [options.searchText] - Filter todos containing this text (case-insensitive)
 * @param {boolean} [options.includeIndices] - Include original 1-based indices in the result
 * @param {boolean} [options.currentProject] - Filter by current project (auto-detected)
 * @returns {Promise<Array>} Filtered array of todo objects (with optional _index field if includeIndices=true)
 */
export async function filterTodos(options = {}) {
  let todos = await readTodos();

  // Add original indices if requested
  if (options.includeIndices) {
    todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
  }

  // Current project filter
  if (options.currentProject) {
    const projectName = await detectProjectName();
    if (projectName) {
      todos = todos.filter((t) => t.category === projectName);
    }
  }

  if (options.category) {
    todos = todos.filter((t) => t.category === options.category);
  }

  if (options.subcategory) {
    // Subcategory filter (only makes sense if category is also set)
    todos = todos.filter((t) => t.subcategory === options.subcategory);
  }

  if (options.untagged === true) {
    todos = todos.filter((t) => !t.category);
  }

  if (options.dateFrom) {
    const fromDate = new Date(options.dateFrom);
    todos = todos.filter((t) => new Date(t.added) >= fromDate);
  }

  if (options.dateTo) {
    const toDate = new Date(options.dateTo);
    todos = todos.filter((t) => new Date(t.added) <= toDate);
  }

  if (options.searchText) {
    const searchLower = options.searchText.toLowerCase();
    todos = todos.filter((t) => t.task.toLowerCase().includes(searchLower));
  }

  return todos;
}

/**
 * Get all unique categories from todos
 * @returns {Promise<Array<string>>} Array of unique category strings (excludes null/undefined)
 */
export async function getCategories() {
  const todos = await readTodos();
  const categories = new Set();

  todos.forEach((todo) => {
    if (todo.category) {
      categories.add(todo.category);
    }
  });

  return Array.from(categories).sort();
}

/**
 * Get statistics about todos
 * @param {Object} [options] - Optional filter to get stats for specific subset
 * @returns {Promise<Object>} Stats object with total, byCategory, and untagged counts
 */
export async function getStats(options = {}) {
  const todos = options && Object.keys(options).length > 0
    ? await filterTodos(options)
    : await readTodos();

  const stats = {
    total: todos.length,
    byCategory: {},
    untagged: 0,
  };

  todos.forEach((todo) => {
    if (todo.category) {
      stats.byCategory[todo.category] = (stats.byCategory[todo.category] || 0) + 1;
    } else {
      stats.untagged++;
    }
  });

  return stats;
}

/**
 * Update a single todo by index
 * @param {number} index - 1-based index of the todo to update
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.task] - New task text
 * @param {string|null} [updates.category] - New category (use null to remove category)
 * @param {string|null} [updates.subcategory] - New subcategory (use null to remove subcategory)
 * @param {Object} options - Options
 * @param {boolean} options.filterByProject - Was list filtered by project?
 * @returns {Promise<{todos: Array, updated: Object}>} Updated todos array and the updated todo object
 * @throws {Error} If index is invalid or no updates provided
 */
export async function updateTodo(index, updates = {}, options = {}) {
  if (!updates.task && updates.category === undefined && updates.subcategory === undefined) {
    throw new Error("No updates provided. Specify at least task, category, or subcategory.");
  }

  // Read with same filter as display
  const displayTodos = await readTodos(options);
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= displayTodos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${displayTodos.length}`);
  }

  const toUpdate = displayTodos[arrayIndex];

  // Use the ID-based function for robustness
  if (!toUpdate.id) {
    throw new Error("Todo does not have an ID. Run migration script.");
  }

  return await updateTodoById(toUpdate.id, updates);
}

/**
 * Update a single todo by ID
 * @param {string} id - UUID of the todo to update
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.task] - New task text
 * @param {string|null} [updates.category] - New category (use null to remove category)
 * @param {string|null} [updates.subcategory] - New subcategory (use null to remove subcategory)
 * @returns {Promise<{todos: Array, updated: Object}>} Updated todos array and the updated todo object
 * @throws {Error} If id not found or no updates provided
 */
export async function updateTodoById(id, updates = {}) {
  if (!updates.task && updates.category === undefined && updates.subcategory === undefined) {
    throw new Error("No updates provided. Specify at least task, category, or subcategory.");
  }

  const todos = await readTodos();
  const result = await findTodoById(id, todos);

  if (!result) {
    throw new Error(`Todo with id "${id}" not found`);
  }

  const todo = result.todo;

  if (updates.task !== undefined) {
    todo.task = updates.task;
  }

  if (updates.category !== undefined) {
    todo.category = updates.category;
  }

  if (updates.subcategory !== undefined) {
    todo.subcategory = updates.subcategory;
  }

  await writeTodos(todos);

  return { todos, updated: todo };
}

/**
 * Remove a todo by ID (permanently delete, no history)
 * @param {string} id - UUID of the todo to remove
 * @returns {Promise<{todos: Array, removed: Object}>} Updated todos array and the removed todo object
 * @throws {Error} If id not found
 */
export async function removeTodoById(id) {
  const todos = await readTodos();
  const result = await findTodoById(id, todos);

  if (!result) {
    throw new Error(`Todo with id "${id}" not found`);
  }

  const removed = todos.splice(result.index, 1)[0];
  await writeTodos(todos);

  return { todos, removed };
}

/**
 * Complete a todo by ID (move to history)
 * @param {string} id - UUID of the todo to complete
 * @returns {Promise<{todos: Array, completed: Object}>} Updated todos array and the completed todo object
 * @throws {Error} If id not found
 */
export async function completeTodoById(id) {
  const todos = await readTodos();
  const result = await findTodoById(id, todos);

  if (!result) {
    throw new Error(`Todo with id "${id}" not found`);
  }

  // Get history and apply lazy clearing
  let history = await readHistory();
  history = clearHistoryIfNewDay(history);

  // Remove from todos and add to history
  const completed = todos.splice(result.index, 1)[0];
  completed.completedAt = new Date().toISOString();

  history.completed.push(completed);

  // Write both files
  await writeTodos(todos);
  await writeHistory(history);

  return { todos, completed };
}

/**
 * Restore a completed todo by ID back to active list
 * @param {string} id - UUID of the completed todo to restore
 * @returns {Promise<{todos: Array, restored: Object}>} Updated todos array and the restored todo object
 * @throws {Error} If id not found in history
 */
export async function restoreTodoById(id) {
  const history = await readHistory();
  const historyIndex = history.completed.findIndex(t => t.id === id);

  if (historyIndex === -1) {
    throw new Error(`Completed todo with id "${id}" not found in history`);
  }

  // Remove from history
  const restored = history.completed.splice(historyIndex, 1)[0];

  // Remove completedAt timestamp
  delete restored.completedAt;

  // Add back to todos
  const todos = await readTodos();
  todos.push(restored);

  // Write both files (todos first to prevent data loss if history write fails)
  await writeTodos(todos);
  await writeHistory(history);

  return { todos, restored };
}

/**
 * Remove item(s) from history permanently
 * @param {string|Array<string>|Object} idOrFilter - Single ID, array of IDs, or filter object
 * @returns {Promise<{removed: Array, count: number}>} Removed items and count
 */
export async function removeFromHistory(idOrFilter) {
  const history = await readHistory();
  const removed = [];

  if (typeof idOrFilter === 'string') {
    // Single ID
    const index = history.completed.findIndex(t => t.id === idOrFilter);
    if (index !== -1) {
      removed.push(history.completed.splice(index, 1)[0]);
    }
  } else if (Array.isArray(idOrFilter)) {
    // Array of IDs
    if (idOrFilter.length === 0) {
      throw new Error("ids array cannot be empty");
    }
    const idSet = new Set(idOrFilter);
    const remaining = [];
    for (const item of history.completed) {
      if (idSet.has(item.id)) {
        removed.push(item);
      } else {
        remaining.push(item);
      }
    }
    history.completed = remaining;
  } else if (typeof idOrFilter === 'object') {
    // Filter - validate not empty
    const filterKeys = Object.keys(idOrFilter);
    const validKeys = ['category', 'subcategory', 'untagged', 'dateFrom', 'dateTo', 'searchText'];
    const hasValidFilter = filterKeys.some(key => validKeys.includes(key));
    if (!hasValidFilter) {
      throw new Error("Empty filter would remove all history items. Provide id, ids array, or filter criteria.");
    }
    const toRemove = await filterHistoryItems(history.completed, idOrFilter);
    const removeIds = new Set(toRemove.map(t => t.id));
    const remaining = [];
    for (const item of history.completed) {
      if (removeIds.has(item.id)) {
        removed.push(item);
      } else {
        remaining.push(item);
      }
    }
    history.completed = remaining;
  }

  await writeHistory(history);
  return { removed, count: removed.length };
}

/**
 * Update item(s) in history
 * @param {string|Array<string>|Object} idOrFilter - Single ID, array of IDs, or filter object
 * @param {Object} updates - Updates to apply {task, category, subcategory}
 * @returns {Promise<{updated: Array, count: number}>} Updated items and count
 */
export async function updateHistory(idOrFilter, updates) {
  // Validate updates object
  if (!updates.task && updates.category === undefined && updates.subcategory === undefined) {
    throw new Error("No updates provided. Specify at least task, category, or subcategory.");
  }

  const history = await readHistory();
  const updated = [];

  let toUpdate = [];

  if (typeof idOrFilter === 'string') {
    // Single ID
    const item = history.completed.find(t => t.id === idOrFilter);
    if (item) toUpdate.push(item);
  } else if (Array.isArray(idOrFilter)) {
    // Array of IDs
    if (idOrFilter.length === 0) {
      throw new Error("ids array cannot be empty");
    }
    toUpdate = history.completed.filter(t => idOrFilter.includes(t.id));
  } else if (typeof idOrFilter === 'object') {
    // Filter - validate not empty
    const filterKeys = Object.keys(idOrFilter);
    const validKeys = ['category', 'subcategory', 'untagged', 'dateFrom', 'dateTo', 'searchText'];
    const hasValidFilter = filterKeys.some(key => validKeys.includes(key));
    if (!hasValidFilter) {
      throw new Error("Empty filter would update all history items. Provide id, ids array, or filter criteria.");
    }
    toUpdate = await filterHistoryItems(history.completed, idOrFilter);
  }

  // Apply updates
  for (const item of toUpdate) {
    if (updates.task !== undefined) item.task = updates.task;
    if (updates.category !== undefined) item.category = updates.category;
    if (updates.subcategory !== undefined) item.subcategory = updates.subcategory;
    updated.push(item);
  }

  await writeHistory(history);
  return { updated, count: updated.length };
}

/**
 * Clear history (all or filtered)
 * @param {Object} [filter] - Optional filter to clear only matching items
 * @returns {Promise<number>} Number of items cleared
 */
export async function clearHistory(filter = null) {
  const history = await readHistory();
  const initialCount = history.completed.length;

  if (filter) {
    // Validate filter not empty
    const filterKeys = Object.keys(filter);
    const validKeys = ['category', 'subcategory', 'untagged', 'dateFrom', 'dateTo', 'searchText'];
    const hasValidFilter = filterKeys.some(key => validKeys.includes(key));
    if (!hasValidFilter) {
      throw new Error("Empty filter would clear all history. Provide filter criteria or call without filter parameter.");
    }
    // Clear only filtered items
    const toRemove = await filterHistoryItems(history.completed, filter);
    const removeIds = new Set(toRemove.map(t => t.id));
    history.completed = history.completed.filter(item => !removeIds.has(item.id));
  } else {
    // Clear all
    history.completed = [];
    history.lastCleared = new Date().toISOString();
  }

  await writeHistory(history);
  return initialCount - history.completed.length;
}

/**
 * Filter history items based on criteria
 * @param {Array} items - History items to filter
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>} Filtered items
 */
async function filterHistoryItems(items, filter) {
  let filtered = [...items];

  if (filter.category) {
    filtered = filtered.filter(t => t.category === filter.category);
  }

  if (filter.subcategory) {
    filtered = filtered.filter(t => t.subcategory === filter.subcategory);
  }

  if (filter.untagged) {
    filtered = filtered.filter(t => !t.category);
  }

  if (filter.dateFrom) {
    const fromDate = new Date(filter.dateFrom);
    if (isNaN(fromDate.getTime())) {
      throw new Error(`Invalid dateFrom: "${filter.dateFrom}"`);
    }
    filtered = filtered.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= fromDate;
    });
  }

  if (filter.dateTo) {
    const toDate = new Date(filter.dateTo);
    if (isNaN(toDate.getTime())) {
      throw new Error(`Invalid dateTo: "${filter.dateTo}"`);
    }
    filtered = filtered.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt) <= toDate;
    });
  }

  if (filter.searchText) {
    const search = filter.searchText.toLowerCase();
    filtered = filtered.filter(t => t.task.toLowerCase().includes(search));
  }

  return filtered;
}

/**
 * Add multiple todos at once
 * @param {Array<string|Object>} tasks - Array of task strings or objects with {task, autoProject, projectOverride}
 * @param {Object} [defaultOptions] - Default options to apply to all tasks (can be overridden per task)
 * @param {boolean} [defaultOptions.autoProject=true] - Auto-prepend project name by default
 * @param {string} [defaultOptions.projectOverride] - Project name to use for all tasks
 * @returns {Promise<{todos: Array, added: Array, count: number}>} Results
 */
export async function bulkAdd(tasks, defaultOptions = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("Tasks must be a non-empty array");
  }

  const added = [];

  for (const taskInput of tasks) {
    let taskString, options;

    if (typeof taskInput === 'string') {
      taskString = taskInput;
      options = { ...defaultOptions };
    } else if (typeof taskInput === 'object' && taskInput.task) {
      taskString = taskInput.task;
      options = {
        autoProject: taskInput.autoProject ?? defaultOptions.autoProject ?? true,
        projectOverride: taskInput.projectOverride ?? defaultOptions.projectOverride
      };
    } else {
      throw new Error("Each task must be a string or object with 'task' property");
    }

    const result = await addTodo(taskString, options);
    added.push(result.added);
  }

  const todos = await readTodos();
  return { todos, added, count: added.length };
}

/**
 * Update multiple todos by IDs or filter
 * @param {Object} selector - Either {ids: Array<string>} or {filter: Object}
 * @param {Array<string>} [selector.ids] - Array of todo IDs to update
 * @param {Object} [selector.filter] - Filter criteria (same as filterTodos options)
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.task] - New task text
 * @param {string|null} [updates.category] - New category (use null to remove category)
 * @param {string|null} [updates.subcategory] - New subcategory (use null to remove subcategory)
 * @returns {Promise<{todos: Array, updated: Array, count: number}>} Results
 * @throws {Error} If no updates provided or invalid selector
 */
export async function bulkUpdate(selector = {}, updates = {}) {
  if (!updates.task && updates.category === undefined && updates.subcategory === undefined) {
    throw new Error("No updates provided. Specify at least task, category, or subcategory.");
  }

  let toUpdateIds;

  if (selector.ids) {
    // Direct ID list provided
    if (!Array.isArray(selector.ids) || selector.ids.length === 0) {
      throw new Error("ids must be a non-empty array");
    }
    toUpdateIds = new Set(selector.ids);
  } else if (selector.filter !== undefined) {
    // Filter provided
    const toUpdate = await filterTodos(selector.filter);
    toUpdateIds = new Set(toUpdate.map((t) => t.id));
  } else {
    // Backward compatibility: treat selector as filter
    // But reject completely empty selector to prevent accidental bulk updates on all todos
    const hasAnyFilterKey = Object.keys(selector).some(key =>
      ['category', 'subcategory', 'untagged', 'currentProject', 'dateFrom', 'dateTo', 'searchText'].includes(key)
    );
    if (!hasAnyFilterKey) {
      throw new Error("Empty selector would update all todos. Provide ids array or filter criteria.");
    }
    const toUpdate = await filterTodos(selector);
    toUpdateIds = new Set(toUpdate.map((t) => t.id));
  }

  const todos = await readTodos();
  const updated = [];

  todos.forEach((todo) => {
    if (toUpdateIds.has(todo.id)) {
      if (updates.task !== undefined) {
        todo.task = updates.task;
      }
      if (updates.category !== undefined) {
        todo.category = updates.category;
      }
      if (updates.subcategory !== undefined) {
        todo.subcategory = updates.subcategory;
      }
      updated.push({ ...todo });
    }
  });

  await writeTodos(todos);

  return { todos, updated, count: updated.length };
}

/**
 * Delete multiple todos by IDs or filter
 * @param {Object} selector - Either {ids: Array<string>} or {filter: Object}
 * @param {Array<string>} [selector.ids] - Array of todo IDs to delete
 * @param {Object} [selector.filter] - Filter criteria (same as filterTodos options)
 * @returns {Promise<{todos: Array, deleted: Array, count: number}>} Results
 */
export async function bulkDelete(selector = {}) {
  let toDeleteIds;

  if (selector.ids) {
    // Direct ID list provided
    if (!Array.isArray(selector.ids) || selector.ids.length === 0) {
      throw new Error("ids must be a non-empty array");
    }
    toDeleteIds = new Set(selector.ids);
  } else if (selector.filter !== undefined) {
    // Filter provided
    const toDelete = await filterTodos(selector.filter);
    toDeleteIds = new Set(toDelete.map((t) => t.id));
  } else {
    // Backward compatibility: treat selector as filter
    // But reject completely empty selector to prevent accidental deletion of all todos
    const hasAnyFilterKey = Object.keys(selector).some(key =>
      ['category', 'subcategory', 'untagged', 'currentProject', 'dateFrom', 'dateTo', 'searchText'].includes(key)
    );
    if (!hasAnyFilterKey) {
      throw new Error("Empty selector would delete all todos. Provide ids array or filter criteria.");
    }
    const toDelete = await filterTodos(selector);
    toDeleteIds = new Set(toDelete.map((t) => t.id));
  }

  const todos = await readTodos();
  const deleted = [];

  const remaining = todos.filter((todo) => {
    if (toDeleteIds.has(todo.id)) {
      deleted.push({ ...todo });
      return false;
    }
    return true;
  });

  await writeTodos(remaining);

  return { todos: remaining, deleted, count: deleted.length };
}

/**
 * Format a single todo item for display
 * @param {Object} todo - Todo object (must include _index field)
 * @param {Object} colors - Color profile to use
 * @returns {string} Formatted todo line
 */
function formatTodoItem(todo, colors) {
  const index = todo._index;

  const date = new Date(todo.added);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Use TodoCategory for consistent formatting
  const todoCategory = TodoCategory.fromStorage(todo);
  let categoryTag = "";

  if (!todoCategory.isUntagged()) {
    const categoryStr = todoCategory.toString();
    if (todo.subcategory) {
      // 2-level: show as category/subcategory with color coding
      categoryTag = `${colors.category}[${todo.category}/${colors.subcategory}${todo.subcategory}${colors.category}]\x1b[0m `;
    } else {
      // 1-level: show as category
      categoryTag = `${colors.category}[${categoryStr}]\x1b[0m `;
    }
  }

  return `${colors.index}${index}.\x1b[0m ${categoryTag}${colors.task}${todo.task}\x1b[0m\n   ${colors.timestamp}${dateStr}\x1b[0m`;
}

/**
 * Format a completed todo item for display
 * @param {Object} todo - Completed todo object
 * @param {Object} colors - Color profile to use
 * @returns {string} Formatted completed todo line
 */
function formatCompletedItem(todo, colors) {
  const time = new Date(todo.completedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Use TodoCategory for consistent formatting
  const todoCategory = TodoCategory.fromStorage(todo);
  let categoryTag = "";

  if (!todoCategory.isUntagged()) {
    const categoryStr = todoCategory.toString();
    if (todo.subcategory) {
      // 2-level: show as category/subcategory with color coding
      categoryTag = `${colors.category}[${todo.category}/${colors.subcategory}${todo.subcategory}${colors.category}]\x1b[0m `;
    } else {
      // 1-level: show as category
      categoryTag = `${colors.category}[${categoryStr}]\x1b[0m `;
    }
  }

  return `${colors.completed}✓\x1b[0m ${categoryTag}${colors.timestamp}${todo.task}\x1b[0m\n   ${colors.timestamp}${time}\x1b[0m`;
}

const UNTAGGED_GROUP_KEY = '__untagged__';

/**
 * Group todos hierarchically by category/subcategory for display
 * @param {Array} todos - Array of todo objects (should have _index field set)
 * @returns {Array} Array of hierarchical groups with category, subcategories, and todos
 */
function groupTodosByCategory(todos) {
  const categoryMap = new Map(); // Top-level categories

  // Organize into hierarchical structure
  todos.forEach((todo) => {
    const category = todo.category || UNTAGGED_GROUP_KEY;
    const subcategory = todo.subcategory || null;

    // Ensure top-level category exists
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category: category,
        subcategories: new Map()
      });
    }

    const catGroup = categoryMap.get(category);

    // Ensure subcategory exists (or null for no subcategory)
    if (!catGroup.subcategories.has(subcategory)) {
      catGroup.subcategories.set(subcategory, []);
    }

    // Add todo to subcategory
    catGroup.subcategories.get(subcategory).push(todo);
  });

  // Convert to array and sort
  const groups = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    subcategories: Array.from(data.subcategories.entries()).map(([subcat, todos]) => ({
      subcategory: subcat,
      todos
    })).sort((a, b) => {
      // Sort subcategories: null (no subcategory) first, then alphabetically
      if (a.subcategory === null) return -1;
      if (b.subcategory === null) return 1;
      return a.subcategory.localeCompare(b.subcategory);
    })
  }));

  // Sort top-level categories: untagged last, others alphabetically
  groups.sort((a, b) => {
    if (a.category === UNTAGGED_GROUP_KEY) return 1;
    if (b.category === UNTAGGED_GROUP_KEY) return -1;
    return a.category.localeCompare(b.category);
  });

  return groups;
}

/**
 * Format the todo list as a colored ANSI box with optional completed section
 * @param {Array} todos - Array of todo objects (must have _index field set)
 * @param {string} [categoryFilter] - Optional category filter being applied
 * @param {Array} [completed] - Optional array of completed todos to show
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.includeIdMap] - Include machine-readable index→ID mapping
 * @returns {Promise<string>} Formatted box with todos
 */
export async function formatTodoList(todos, categoryFilter = null, completed = null, options = {}) {
  // Load color profile and scope from config
  const colors = await getColorProfile();
  const scope = await getScope();
  const scopeLabel = scope === "global" ? "All Projects" : "Current Project";

  // Use fixed width that works well across different terminal sizes
  const boxWidth = 45;

  // Calculate separator width (box width minus padding and borders)
  const separatorWidth = boxWidth - 8;

  const sections = [];
  let flattenedTodos = []; // For ID mapping after grouping

  // Active todos section
  if (todos.length === 0) {
    const emptyMessage = categoryFilter
      ? `${colors.empty}No active todos in category [${categoryFilter}]\x1b[0m`
      : `${colors.empty}No active todos!\x1b[0m`;
    sections.push(emptyMessage);
  } else {
    // Group todos hierarchically by category
    const groups = groupTodosByCategory(todos);

    // Reassign sequential indices after grouping for display order
    let displayIndex = 1;
    groups.forEach(group => {
      group.subcategories.forEach(subGroup => {
        subGroup.todos.forEach(todo => {
          todo._index = displayIndex++;
          flattenedTodos.push(todo); // Build flattened list in display order
        });
      });
    });

    // Render hierarchical structure
    groups.forEach((group, groupIndex) => {
      // Add separator between top-level categories (but not before first)
      if (groupIndex > 0) {
        sections.push("");
      }

      // Add category header
      if (group.category === UNTAGGED_GROUP_KEY) {
        sections.push(`${colors.untaggedHeader}(untagged)\x1b[0m`);
      } else {
        sections.push(`${colors.categoryHeader}${group.category}\x1b[0m`);
      }

      // Add subcategories
      group.subcategories.forEach((subGroup, subIndex) => {
        // Add subcategory header if it exists
        if (subGroup.subcategory !== null) {
          sections.push(`  ${colors.subcategoryHeader}${subGroup.subcategory}\x1b[0m`);
        }

        // Add todos in this subcategory
        const todoLines = subGroup.todos.map(todo => formatTodoItem(todo, colors)).join("\n");
        sections.push(todoLines);
      });
    });
  }

  // Completed section (if provided and not empty)
  if (completed && completed.length > 0) {
    sections.push(""); // blank line separator
    sections.push(colors.timestamp + "─".repeat(separatorWidth) + "\x1b[0m"); // dynamic separator
    sections.push(`${colors.completed}✓ Completed Today\x1b[0m`);
    sections.push(""); // blank line
    const completedLines = completed.map(todo => formatCompletedItem(todo, colors)).join("\n");
    sections.push(completedLines);
  }

  const content = sections.join("\n");
  const titleSuffix = categoryFilter ? ` [${categoryFilter}]` : "";
  const todoCount = todos.length > 0 ? `(${todos.length})` : "";

  const box = boxen(content, {
    title: `${colors.title}📋 ${scopeLabel} To-Dos ${todoCount}${titleSuffix}\x1b[0m`,
    titleAlignment: "left",
    padding: 1,
    margin: 0,
    borderStyle: "round",
    width: boxWidth,
  });

  // Color all border characters
  let output = box
    .replace(/╭/g, `${colors.border}╭\x1b[0m`)
    .replace(/╮/g, `${colors.border}╮\x1b[0m`)
    .replace(/╰/g, `${colors.border}╰\x1b[0m`)
    .replace(/╯/g, `${colors.border}╯\x1b[0m`)
    .replace(/│/g, `${colors.border}│\x1b[0m`)
    .replace(/─/g, `${colors.border}─\x1b[0m`);

  // Add machine-readable ID mapping as HTML comment if requested
  // This is invisible in most markdown renderers but visible in raw output
  if (options.includeIdMap && flattenedTodos.length > 0) {
    const idMap = flattenedTodos.map(t => ({
      index: t._index,
      id: t.id
    }));

    // Place at end without visible newlines - Claude can still parse it
    output += `<!-- ID_MAP: ${JSON.stringify(idMap)} -->`;
  }

  return output;
}
