#!/usr/bin/env node

import { readTodos, writeTodos, formatTodoList } from "./lib.js";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case "list": {
        const todos = await readTodos();
        console.log(formatTodoList(todos));
        break;
      }

      case "add": {
        const task = args.join(" ");
        if (!task) {
          console.error("Error: Please provide a task to add");
          process.exit(1);
        }

        const todos = await readTodos();
        todos.push({
          task,
          added: new Date().toISOString(),
        });
        await writeTodos(todos);

        console.log(`✓ Added: "${task}"`);
        console.log(formatTodoList(todos));
        break;
      }

      case "remove": {
        const index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1) {
          console.error("Error: Please provide a valid task number");
          process.exit(1);
        }

        const todos = await readTodos();
        const arrayIndex = index - 1;

        if (arrayIndex >= todos.length) {
          console.error(`Error: Task #${index} does not exist`);
          process.exit(1);
        }

        const removed = todos.splice(arrayIndex, 1)[0];
        await writeTodos(todos);

        console.log(`✓ Removed: "${removed.task}"`);
        console.log(formatTodoList(todos));
        break;
      }

      case "clear": {
        await writeTodos([]);
        console.log("✓ All todos cleared");
        console.log(formatTodoList([]));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error("\nUsage:");
        console.error("  cli.js list           - Show todos");
        console.error("  cli.js add <task>     - Add a task");
        console.error("  cli.js remove <index> - Remove a task");
        console.error("  cli.js clear          - Clear all tasks");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
