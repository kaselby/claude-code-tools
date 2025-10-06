#!/usr/bin/env node

import { addTodo, removeTodo, listTodos, clearTodos } from "./lib.js";

function parseArgs(args) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const flagName = arg.slice(2);
      // Check if next arg is the value (not another flag)
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[flagName] = args[i + 1];
        i++; // Skip next arg since we used it as a value
      } else {
        flags[flagName] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

async function main() {
  // Detect if invoked via named bin (e.g., todo-add vs cli.js)
  const scriptName = process.argv[1];
  const invokedAs = scriptName.split('/').pop().replace('.js', '');

  // If invoked as todo-add, todo-list, etc., use that as the command
  let command, rawArgs;
  if (['todo-add', 'todo-list', 'todo-remove', 'todo-clear'].includes(invokedAs)) {
    command = invokedAs.replace('todo-', '');
    rawArgs = process.argv.slice(2);
  } else {
    // Otherwise, expect command as first argument (e.g., cli.js add ...)
    [,, command, ...rawArgs] = process.argv;
  }

  const { flags, positional } = parseArgs(rawArgs);

  try {
    switch (command) {
      case "list": {
        // Category can come from flag or first positional argument
        const category = flags.category || flags.c || positional[0];
        const output = await listTodos(category);
        console.log(output);
        break;
      }
      case "add": {
        if (!positional.length) {
          console.error("Error: Task description required");
          process.exit(1);
        }
        let task = positional.join(" ");
        let category = flags.category || flags.c;

        // Parse category::task syntax if no explicit category flag
        if (!category && task.includes("::")) {
          const firstColonIndex = task.indexOf("::");
          category = task.substring(0, firstColonIndex).trim();
          task = task.substring(firstColonIndex + 2).trim();
        }

        const result = await addTodo(task, category);
        const categoryText = result.category ? ` [${result.category}]` : "";
        console.log(`Added to-do: "${result.task}"${categoryText}\nTotal items: ${result.total}`);
        break;
      }
      case "remove": {
        if (!positional.length) {
          console.error("Error: Index required");
          process.exit(1);
        }
        const result = await removeTodo(parseInt(positional[0], 10));
        console.log(`Removed to-do: "${result.removed.task}"\nRemaining items: ${result.remaining}`);
        break;
      }
      case "clear": {
        const result = await clearTodos();
        console.log(result.message);
        break;
      }
      case "help":
      case "--help":
      case "-h": {
        console.log(`Usage: cli.js <command> [options] [args]

Commands:
  list [--category <name>]     List all todos (optionally filter by category)
  add <task> [--category <name>]  Add a new todo (optionally with category)
  remove <index>               Remove a todo by index (1-based)
  clear                        Clear all todos
  help                         Show this help message

Options:
  --category, -c <name>        Category for organizing todos

Examples:
  cli.js add "Fix authentication bug" --category backend
  cli.js list --category frontend
  cli.js list -c docs
  cli.js remove 1`);
        break;
      }
      default:
        console.error("Usage: cli.js <list|add|remove|clear|help> [args]");
        console.error("Run 'cli.js help' for more information");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
