#!/usr/bin/env node

import { readTodos, formatTodoList, addTodo, removeTodo, clearTodos } from "./lib.js";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case "list": {
        const todos = await readTodos();
        const category = args[0]; // Optional category filter
        const filteredTodos = category
          ? todos.filter((t) => t.category === category)
          : todos;
        console.log(formatTodoList(filteredTodos, category));
        break;
      }

      case "add": {
        const taskString = args.join(" ");
        if (!taskString) {
          console.error("Error: Please provide a task to add");
          process.exit(1);
        }

        const { todos, added } = await addTodo(taskString);

        const displayText = added.category
          ? `✓ Added [${added.category}]: "${added.task}"`
          : `✓ Added: "${added.task}"`;
        console.log(displayText);
        console.log(formatTodoList(todos));
        break;
      }

      case "remove": {
        const index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1) {
          console.error("Error: Please provide a valid task number");
          process.exit(1);
        }

        try {
          const { todos, removed } = await removeTodo(index);
          console.log(`✓ Removed: "${removed.task}"`);
          console.log(formatTodoList(todos));
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case "clear": {
        const count = await clearTodos();
        console.log(`✓ All todos cleared (${count} items removed)`);
        console.log(formatTodoList([]));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error("\nUsage:");
        console.error("  cli.js list [category]    - Show todos (optionally filtered by category)");
        console.error("  cli.js add <task>         - Add a task (use 'category::task' for tagged tasks)");
        console.error("  cli.js remove <index>     - Remove a task");
        console.error("  cli.js clear              - Clear all tasks");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
