import fs from "fs/promises";
import path from "path";
import boxen from "boxen";

const TODO_FILE = ".project-todos.json";

/**
 * Get the path to the todo file in the current working directory
 */
export async function getTodoFilePath() {
  const cwd = process.cwd();
  return path.join(cwd, TODO_FILE);
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
 * Add a todo with optional category parsing
 * @param {string} taskString - Task string, optionally with category prefix (category::task)
 * @returns {Promise<{todos: Array, added: Object}>} Updated todos array and the added todo object
 */
export async function addTodo(taskString) {
  // Parse category from task string (format: category::task)
  let task = taskString;
  let category = null;
  const categoryMatch = taskString.match(/^([^:]+)::(.+)$/);
  if (categoryMatch) {
    category = categoryMatch[1].trim();
    task = categoryMatch[2].trim();
  }

  const todos = await readTodos();
  const newTodo = {
    task,
    category,
    added: new Date().toISOString(),
  };
  todos.push(newTodo);
  await writeTodos(todos);

  return { todos, added: newTodo };
}

/**
 * Remove a todo by index
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
 * Clear all todos
 * @returns {Promise<number>} Number of todos that were cleared
 */
export async function clearTodos() {
  const previousCount = (await readTodos()).length;
  await writeTodos([]);
  return previousCount;
}

/**
 * Filter todos based on various criteria
 * @param {Object} options - Filter options
 * @param {string} [options.category] - Filter by category
 * @param {boolean} [options.untagged] - Filter for todos without a category
 * @param {string} [options.dateFrom] - Filter todos added on or after this date (ISO string)
 * @param {string} [options.dateTo] - Filter todos added on or before this date (ISO string)
 * @param {string} [options.searchText] - Filter todos containing this text (case-insensitive)
 * @returns {Promise<Array>} Filtered array of todo objects
 */
export async function filterTodos(options = {}) {
  let todos = await readTodos();

  if (options.category) {
    todos = todos.filter((t) => t.category === options.category);
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
 * @returns {Promise<{todos: Array, updated: Object}>} Updated todos array and the updated todo object
 * @throws {Error} If index is invalid or no updates provided
 */
export async function updateTodo(index, updates = {}) {
  if (!updates.task && updates.category === undefined) {
    throw new Error("No updates provided. Specify at least task or category.");
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
 * @param {Object} todo - Todo object
 * @param {number} index - 1-based index
 * @returns {string} Formatted todo line
 */
function formatTodoItem(todo, index) {
  const date = new Date(todo.added);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Bright white number with cyan background for contrast, bright white task, gray timestamp on newline
  const cyanBg = "\x1b[46m"; // Standard cyan background (original)
  const categoryTag = todo.category ? `\x1b[35m[${todo.category}]\x1b[0m ` : "";
  return `${cyanBg}\x1b[97m${index}.\x1b[0m ${categoryTag}\x1b[97m${todo.task}\x1b[0m\n   \x1b[90m${dateStr}\x1b[0m`;
}

/**
 * Format the todo list as a colored ANSI box
 * @param {Array} todos - Array of todo objects
 * @param {string} [categoryFilter] - Optional category filter being applied
 * @returns {string} Formatted box with todos
 */
export function formatTodoList(todos, categoryFilter = null) {
  if (todos.length === 0) {
    const emptyMessage = categoryFilter
      ? `\x1b[33mNo todos in category [${categoryFilter}]\x1b[0m`
      : "\x1b[33mNo todos yet!\x1b[0m";
    const box = boxen(emptyMessage, {
      title: "\x1b[95m📋 Project To-Dos\x1b[0m",
      titleAlignment: "left",
      padding: 1,
      margin: 0,
      borderStyle: "round",
      width: 40,
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

  const todoLines = todos.map((todo, i) => formatTodoItem(todo, i + 1)).join("\n");

  const titleSuffix = categoryFilter ? ` [${categoryFilter}]` : "";
  const box = boxen(todoLines, {
    title: `\x1b[95m📋 Project To-Dos (${todos.length})${titleSuffix}\x1b[0m`,
    titleAlignment: "left",
    padding: 1,
    margin: 0,
    borderStyle: "round",
    width: 40,
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

