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
  return `${cyanBg}\x1b[97m${index}.\x1b[0m \x1b[97m${todo.task}\x1b[0m\n   \x1b[90m${dateStr}\x1b[0m`;
}

/**
 * Format the todo list as a colored ANSI box
 * @param {Array} todos - Array of todo objects
 * @returns {string} Formatted box with todos
 */
export function formatTodoList(todos) {
  if (todos.length === 0) {
    const box = boxen("\x1b[33mNo todos yet!\x1b[0m", {
      title: "\x1b[95m📋 Project To-Dos\x1b[0m",
      titleAlignment: "left",
      padding: 1,
      margin: 0,
      borderStyle: "round",
      width: 50,
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

  const box = boxen(todoLines, {
    title: `\x1b[95m📋 Project To-Dos (${todos.length})\x1b[0m`,
    titleAlignment: "left",
    padding: 1,
    margin: 0,
    borderStyle: "round",
    width: 50,
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

/**
 * Format a simple list (for MCP server responses)
 * @param {Array} todos - Array of todo objects
 * @returns {string} Simple text list
 */
export function formatSimpleList(todos) {
  if (todos.length === 0) {
    return "No items in the to-do list.";
  }

  const list = todos.map((todo, i) => `${i + 1}. ${todo.task}`).join("\n");
  return `Project To-Do List (${todos.length} items):\n\n${list}`;
}
