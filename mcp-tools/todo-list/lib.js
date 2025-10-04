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

