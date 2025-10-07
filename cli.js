#!/usr/bin/env node

import {
  readTodos,
  formatTodoList,
  addTodo,
  removeTodo,
  completeTodo,
  clearTodos,
  queryHistory,
  restoreTodo
} from "./lib.js";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case "list": {
        let todos = await readTodos();
        // Add indices BEFORE filtering
        todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
        const history = await queryHistory();
        const category = args[0]; // Optional category filter
        const filteredTodos = category
          ? todos.filter((t) => t.category === category)
          : todos;
        console.log(formatTodoList(filteredTodos, category, history));
        break;
      }

      case "add": {
        const taskString = args.join(" ");
        if (!taskString) {
          console.error("Error: Please provide a task to add");
          process.exit(1);
        }

        let { todos, added } = await addTodo(taskString);
        // Add indices for display
        todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
        const history = await queryHistory();

        const displayText = added.category
          ? `✓ Added [${added.category}]: "${added.task}"`
          : `✓ Added: "${added.task}"`;
        console.log(displayText);
        console.log(formatTodoList(todos, null, history));
        break;
      }

      case "remove": {
        const index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1) {
          console.error("Error: Please provide a valid task number");
          process.exit(1);
        }

        try {
          let { todos, removed } = await removeTodo(index);
          // Add indices for display
          todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
          const history = await queryHistory();
          console.log(`✓ Removed: "${removed.task}"`);
          console.log(formatTodoList(todos, null, history));
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case "complete": {
        const index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1) {
          console.error("Error: Please provide a valid task number");
          process.exit(1);
        }

        try {
          let { todos, completed } = await completeTodo(index);
          // Add indices for display
          todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
          const history = await queryHistory();
          const displayText = completed.category
            ? `✓ Completed [${completed.category}]: "${completed.task}"`
            : `✓ Completed: "${completed.task}"`;
          console.log(displayText);
          console.log(formatTodoList(todos, null, history));
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case "history": {
        const history = await queryHistory();
        if (history.length === 0) {
          console.log("No completed todos today.");
        } else {
          const historyText = history
            .map((t, i) => {
              const cat = t.category ? `[${t.category}${t.subcategory ? `/${t.subcategory}` : ''}] ` : '';
              const time = new Date(t.completedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              });
              return `  ${i + 1}. ${cat}${t.task}\n     Completed: ${time}`;
            })
            .join('\n\n');
          console.log(`✓ Completed Today (${history.length}):\n\n${historyText}`);
        }
        break;
      }

      case "restore": {
        const index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1) {
          console.error("Error: Please provide a valid history index");
          process.exit(1);
        }

        try {
          let { todos, restored } = await restoreTodo(index);
          // Add indices for display
          todos = todos.map((t, i) => ({ ...t, _index: i + 1 }));
          const history = await queryHistory();
          const displayText = restored.category
            ? `✓ Restored [${restored.category}]: "${restored.task}"`
            : `✓ Restored: "${restored.task}"`;
          console.log(displayText);
          console.log(formatTodoList(todos, null, history));
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case "clear": {
        const count = await clearTodos();
        const history = await queryHistory();
        console.log(`✓ All todos cleared (${count} items removed)`);
        // Empty array already has no indices, but add for consistency
        console.log(formatTodoList([], null, history));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error("\nUsage:");
        console.error("  cli.js list [category]    - Show todos (optionally filtered by category)");
        console.error("  cli.js add <task>         - Add a task (use 'cat/subcat::task' for categorized tasks)");
        console.error("  cli.js complete <index>   - Mark a task as complete (moves to history)");
        console.error("  cli.js remove <index>     - Permanently remove a task (no history)");
        console.error("  cli.js history            - Show completed tasks from today");
        console.error("  cli.js restore <index>    - Restore a task from history");
        console.error("  cli.js clear              - Clear all tasks");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
