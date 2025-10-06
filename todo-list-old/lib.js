import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const TODO_FILE = ".project-todos.json";

// Schema for validating todo items
const TodoSchema = z.array(
  z.object({
    task: z.string(),
    added: z.string().datetime(),
    category: z.string().optional(),
  })
);

export async function getTodoFilePath() {
  const cwd = process.cwd();
  return path.join(cwd, TODO_FILE);
}

export async function readTodos() {
  try {
    const filePath = await getTodoFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data);
    // Validate data structure
    return TodoSchema.parse(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    // If validation fails or JSON is invalid, provide helpful error
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid todo data format: ${error.message}`);
    }
    throw error;
  }
}

export async function writeTodos(todos) {
  const filePath = await getTodoFilePath();
  await fs.writeFile(filePath, JSON.stringify(todos, null, 2), "utf-8");
}

export function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function formatTodoList(todos) {
  if (todos.length === 0) {
    return "No items in the to-do list.";
  }

  const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
  };

  const box = {
    tl: "╭",
    tr: "╮",
    bl: "╰",
    br: "╯",
    h: "─",
    v: "│",
  };

  const width = 45;
  const title = `${colors.bright}${colors.cyan} TO-DO LIST ${colors.reset}`;
  const titlePlain = " TO-DO LIST ";
  const count = `${colors.gray}(${todos.length} item${todos.length !== 1 ? "s" : ""})${colors.reset}`;

  const topBorder = `${colors.cyan}${box.tl}${box.h.repeat(width - 2)}${box.tr}${colors.reset}`;
  const bottomBorder = `${colors.cyan}${box.bl}${box.h.repeat(width - 2)}${box.br}${colors.reset}`;

  const countPlain = `(${todos.length} item${todos.length !== 1 ? "s" : ""})`;
  const titleContentLength = titlePlain.length + countPlain.length;
  const titlePadding = width - titleContentLength - 2;
  const titleLine = `${colors.cyan}${box.v}${colors.reset}${title}${count}${" ".repeat(titlePadding)}${colors.cyan}${box.v}${colors.reset}`;
  const separator = `${colors.cyan}${box.v}${colors.gray}${box.h.repeat(width - 2)}${colors.cyan}${box.v}${colors.reset}`;

  const items = todos.map((todo, i) => {
    const num = `${colors.bright}${colors.blue}${i + 1}.${colors.reset}`;
    const numPlain = `${i + 1}.`;
    const timestamp = `${colors.gray}${formatDate(todo.added)}${colors.reset}`;
    const timestampPlain = formatDate(todo.added);

    // Add category badge if present
    const categoryBadge = todo.category ? `${colors.bright}[${todo.category}]${colors.reset} ` : "";
    const categoryBadgePlain = todo.category ? `[${todo.category}] ` : "";

    const availableForText = width - 2 - 2 - numPlain.length - 1 - categoryBadgePlain.length - timestampPlain.length - 2;
    const taskLines = wrapText(todo.task, availableForText);

    const lines = [];
    taskLines.forEach((line, idx) => {
      if (idx === 0) {
        const textPadding = availableForText - line.length;
        lines.push(`${colors.cyan}${box.v}${colors.reset} ${num} ${categoryBadge}${line}${" ".repeat(textPadding)}  ${timestamp} ${colors.cyan}${box.v}${colors.reset}`);
      } else {
        const indent = " ".repeat(numPlain.length + 1 + categoryBadgePlain.length);
        const totalSpace = width - 4;
        const usedSpace = indent.length + line.length;
        const padding = totalSpace - usedSpace;
        lines.push(`${colors.cyan}${box.v}${colors.reset} ${indent}${line}${" ".repeat(padding)} ${colors.cyan}${box.v}${colors.reset}`);
      }
    });

    return lines.join("\n");
  }).join("\n");

  return [
    topBorder,
    titleLine,
    separator,
    items,
    bottomBorder,
  ].join("\n");
}

export async function addTodo(task, category) {
  const todos = await readTodos();
  const newTodo = {
    task,
    added: new Date().toISOString(),
  };
  if (category) {
    newTodo.category = category;
  }
  todos.push(newTodo);
  await writeTodos(todos);
  return {
    task,
    category,
    total: todos.length,
  };
}

export async function removeTodo(index) {
  const todos = await readTodos();
  const idx = index - 1;

  if (idx < 0 || idx >= todos.length) {
    throw new Error(`Invalid index ${index}. Valid range: 1-${todos.length}`);
  }

  const removed = todos.splice(idx, 1)[0];
  await writeTodos(todos);
  return {
    removed,
    remaining: todos.length,
  };
}

export async function listTodos(category) {
  let todos = await readTodos();

  // Filter by category if provided
  if (category) {
    todos = todos.filter(todo => todo.category === category);
  }

  return formatTodoList(todos);
}

export async function clearTodos() {
  await writeTodos([]);
  return {
    message: "All todos cleared",
  };
}
