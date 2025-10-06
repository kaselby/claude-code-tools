import fs from "fs/promises";
import path from "path";
import boxen from "boxen";

const TODO_FILE = ".project-todos.json";
const HISTORY_FILE = ".project-todos-history.json";

/**
 * Get the path to the todo file in the current working directory
 */
export async function getTodoFilePath() {
  const cwd = process.cwd();
  return path.join(cwd, TODO_FILE);
}

/**
 * Get the path to the history file in the current working directory
 */
export async function getHistoryFilePath() {
  const cwd = process.cwd();
  return path.join(cwd, HISTORY_FILE);
}

/**
 * Read todos from the project file
 * @returns {Promise<Array>} Array of todo objects
 */
export async function readTodos() {
  try {
    const filePath = await getTodoFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Write todos to the project file
 * @param {Array} todos - Array of todo objects
 */
export async function writeTodos(todos) {
  const filePath = await getTodoFilePath();
  await fs.writeFile(filePath, JSON.stringify(todos, null, 2), "utf-8");
}

/**
 * Read history from the project file
 * @returns {Promise<Object>} History object with completed array and lastCleared timestamp
 */
export async function readHistory() {
  try {
    const filePath = await getHistoryFilePath();
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
 * Write history to the project file
 * @param {Object} history - History object with completed array and lastCleared timestamp
 */
export async function writeHistory(history) {
  const filePath = await getHistoryFilePath();
  await fs.writeFile(filePath, JSON.stringify(history, null, 2), "utf-8");
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
 * Add a todo with optional category/subcategory parsing
 * @param {string} taskString - Task string, optionally with category prefix (cat/subcat::task or cat::task)
 * @returns {Promise<{todos: Array, added: Object}>} Updated todos array and the added todo object
 */
export async function addTodo(taskString) {
  // Parse category and subcategory from task string
  // Supports: cat/subcat::task or cat::task
  let task = taskString;
  let category = null;
  let subcategory = null;

  const categoryMatch = taskString.match(/^([^:]+)::(.+)$/);
  if (categoryMatch) {
    const categoryPart = categoryMatch[1].trim();
    task = categoryMatch[2].trim();

    // Check if category contains a subcategory (cat/subcat format)
    const subcatMatch = categoryPart.match(/^([^/]+)\/(.+)$/);
    if (subcatMatch) {
      category = subcatMatch[1].trim();
      subcategory = subcatMatch[2].trim();
    } else {
      category = categoryPart;
    }
  }

  const todos = await readTodos();
  const newTodo = {
    task,
    category,
    subcategory,
    added: new Date().toISOString(),
  };
  todos.push(newTodo);
  await writeTodos(todos);

  return { todos, added: newTodo };
}

/**
 * Remove a todo by index (permanently delete, no history)
 * @param {number} index - 1-based index of the todo to remove
 * @returns {Promise<{todos: Array, removed: Object}>} Updated todos array and the removed todo object
 * @throws {Error} If index is invalid
 */
export async function removeTodo(index) {
  const todos = await readTodos();
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= todos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${todos.length}`);
  }

  const removed = todos.splice(arrayIndex, 1)[0];
  await writeTodos(todos);

  return { todos, removed };
}

/**
 * Complete a todo by index (move to history)
 * @param {number} index - 1-based index of the todo to complete
 * @returns {Promise<{todos: Array, completed: Object}>} Updated todos array and the completed todo object
 * @throws {Error} If index is invalid
 */
export async function completeTodo(index) {
  const todos = await readTodos();
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= todos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${todos.length}`);
  }

  // Get history and apply lazy clearing
  let history = await readHistory();
  history = clearHistoryIfNewDay(history);

  // Remove from todos and add to history
  const completed = todos.splice(arrayIndex, 1)[0];
  completed.completedAt = new Date().toISOString();

  history.completed.push(completed);

  // Write both files
  await writeTodos(todos);
  await writeHistory(history);

  return { todos, completed };
}

/**
 * Clear all todos
 * @returns {Promise<number>} Number of todos that were cleared
 */
export async function clearTodos() {
  const previousCount = (await readTodos()).length;
  await writeTodos([]);
  return previousCount;
}

/**
 * Query history (completed todos from today)
 * @returns {Promise<Array>} Array of completed todo objects with completedAt timestamps
 */
export async function queryHistory() {
  let history = await readHistory();
  history = clearHistoryIfNewDay(history);

  // Save if we cleared
  if (history.completed.length === 0 && history.lastCleared) {
    await writeHistory(history);
  }

  return history.completed;
}

/**
 * Restore a completed todo back to active list
 * @param {number} index - 1-based index in the history list
 * @returns {Promise<{todos: Array, restored: Object}>} Updated todos array and the restored todo object
 * @throws {Error} If index is invalid
 */
export async function restoreTodo(index) {
  const history = await readHistory();
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= history.completed.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${history.completed.length}`);
  }

  // Remove from history
  const restored = history.completed.splice(arrayIndex, 1)[0];

  // Remove completedAt timestamp
  delete restored.completedAt;

  // Add back to todos
  const todos = await readTodos();
  todos.push(restored);

  // Write both files
  await writeHistory(history);
  await writeTodos(todos);

  return { todos, restored };
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
 * @returns {Promise<Array>} Filtered array of todo objects (with optional _index field if includeIndices=true)
 */
export async function filterTodos(options = {}) {
  let todos = await readTodos();

  // Add original indices if requested
  if (options.includeIndices) {
    todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
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
 * @returns {Promise<{todos: Array, updated: Object}>} Updated todos array and the updated todo object
 * @throws {Error} If index is invalid or no updates provided
 */
export async function updateTodo(index, updates = {}) {
  if (!updates.task && updates.category === undefined && updates.subcategory === undefined) {
    throw new Error("No updates provided. Specify at least task, category, or subcategory.");
  }

  const todos = await readTodos();
  const arrayIndex = index - 1;

  if (arrayIndex < 0 || arrayIndex >= todos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${todos.length}`);
  }

  const todo = todos[arrayIndex];

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
 * Update multiple todos matching a filter
 * @param {Object} filter - Filter criteria (same as filterTodos options)
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.task] - New task text
 * @param {string|null} [updates.category] - New category (use null to remove category)
 * @returns {Promise<{todos: Array, updated: Array, count: number}>} Results
 * @throws {Error} If no updates provided
 */
export async function bulkUpdate(filter = {}, updates = {}) {
  if (!updates.task && updates.category === undefined) {
    throw new Error("No updates provided. Specify at least task or category.");
  }

  const todos = await readTodos();
  const toUpdate = await filterTodos(filter);
  const updated = [];

  // Create a Set of stringified todos for efficient matching
  const toUpdateSet = new Set(toUpdate.map((t) => JSON.stringify(t)));

  todos.forEach((todo) => {
    if (toUpdateSet.has(JSON.stringify(todo))) {
      if (updates.task !== undefined) {
        todo.task = updates.task;
      }
      if (updates.category !== undefined) {
        todo.category = updates.category;
      }
      updated.push({ ...todo });
    }
  });

  await writeTodos(todos);

  return { todos, updated, count: updated.length };
}

/**
 * Delete multiple todos matching a filter
 * @param {Object} filter - Filter criteria (same as filterTodos options)
 * @returns {Promise<{todos: Array, deleted: Array, count: number}>} Results
 */
export async function bulkDelete(filter = {}) {
  const todos = await readTodos();
  const toDelete = await filterTodos(filter);
  const deleted = [];

  // Create a Set of stringified todos for efficient matching
  const toDeleteSet = new Set(toDelete.map((t) => JSON.stringify(t)));

  const remaining = todos.filter((todo) => {
    if (toDeleteSet.has(JSON.stringify(todo))) {
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
 * @param {Object} todo - Todo object (may include _index field for original index)
 * @param {number} displayIndex - 1-based index for display (fallback if _index not present)
 * @returns {string} Formatted todo line
 */
function formatTodoItem(todo, displayIndex) {
  // Use original index if available, otherwise use display index
  const index = todo._index !== undefined ? todo._index : displayIndex;

  const date = new Date(todo.added);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Bright white number with cyan background for contrast, bright white task, gray timestamp on newline
  const cyanBg = "\x1b[46m"; // Standard cyan background (original)

  // Build category tag with subcategory if present
  let categoryTag = "";
  if (todo.category) {
    if (todo.subcategory) {
      categoryTag = `\x1b[35m[${todo.category}/\x1b[36m${todo.subcategory}\x1b[35m]\x1b[0m `;
    } else {
      categoryTag = `\x1b[35m[${todo.category}]\x1b[0m `;
    }
  }

  return `${cyanBg}\x1b[97m${index}.\x1b[0m ${categoryTag}\x1b[97m${todo.task}\x1b[0m\n   \x1b[90m${dateStr}\x1b[0m`;
}

/**
 * Format a completed todo item for display
 * @param {Object} todo - Completed todo object
 * @returns {string} Formatted completed todo line
 */
function formatCompletedItem(todo) {
  const time = new Date(todo.completedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Build category tag with subcategory if present
  let categoryTag = "";
  if (todo.category) {
    if (todo.subcategory) {
      categoryTag = `\x1b[35m[${todo.category}/\x1b[36m${todo.subcategory}\x1b[35m]\x1b[0m `;
    } else {
      categoryTag = `\x1b[35m[${todo.category}]\x1b[0m `;
    }
  }

  return `\x1b[32m✓\x1b[0m ${categoryTag}\x1b[90m${todo.task}\x1b[0m\n   \x1b[90m${time}\x1b[0m`;
}

/**
 * Format the todo list as a colored ANSI box with optional completed section
 * @param {Array} todos - Array of todo objects
 * @param {string} [categoryFilter] - Optional category filter being applied
 * @param {Array} [completed] - Optional array of completed todos to show
 * @returns {string} Formatted box with todos
 */
export function formatTodoList(todos, categoryFilter = null, completed = null) {
  // Use fixed width that works well across different terminal sizes
  const boxWidth = 45;

  // Calculate separator width (box width minus padding and borders)
  const separatorWidth = boxWidth - 8;

  const sections = [];

  // Active todos section
  if (todos.length === 0) {
    const emptyMessage = categoryFilter
      ? `\x1b[33mNo active todos in category [${categoryFilter}]\x1b[0m`
      : "\x1b[33mNo active todos!\x1b[0m";
    sections.push(emptyMessage);
  } else {
    const todoLines = todos.map((todo, i) => formatTodoItem(todo, i + 1)).join("\n");
    sections.push(todoLines);
  }

  // Completed section (if provided and not empty)
  if (completed && completed.length > 0) {
    sections.push(""); // blank line separator
    sections.push("\x1b[90m" + "─".repeat(separatorWidth) + "\x1b[0m"); // dynamic separator
    sections.push("\x1b[32m✓ Completed Today\x1b[0m");
    sections.push(""); // blank line
    const completedLines = completed.map(todo => formatCompletedItem(todo)).join("\n");
    sections.push(completedLines);
  }

  const content = sections.join("\n");
  const titleSuffix = categoryFilter ? ` [${categoryFilter}]` : "";
  const todoCount = todos.length > 0 ? `(${todos.length})` : "";

  const box = boxen(content, {
    title: `\x1b[95m📋 Project To-Dos ${todoCount}${titleSuffix}\x1b[0m`,
    titleAlignment: "left",
    padding: 1,
    margin: 0,
    borderStyle: "round",
    width: boxWidth,
  });

  // Color all border characters medium blue-cyan
  const blueCyan = "\x1b[38;5;38m"; // 256-color medium blue-cyan (slightly darker)
  return box
    .replace(/╭/g, `${blueCyan}╭\x1b[0m`)
    .replace(/╮/g, `${blueCyan}╮\x1b[0m`)
    .replace(/╰/g, `${blueCyan}╰\x1b[0m`)
    .replace(/╯/g, `${blueCyan}╯\x1b[0m`)
    .replace(/│/g, `${blueCyan}│\x1b[0m`)
    .replace(/─/g, `${blueCyan}─\x1b[0m`);
}

