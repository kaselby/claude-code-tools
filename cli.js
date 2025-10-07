#!/usr/bin/env node

import {
  readTodos,
  formatTodoList,
  addTodo,
  removeTodo,
  completeTodo,
  clearTodos,
  queryHistory,
  restoreTodo,
  detectProjectName
} from "./lib.js";

import {
  readConfig,
  setColorProfile,
  setScope,
  COLOR_PROFILES
} from "./config.js";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    // Get config once for all operations
    const config = await readConfig();
    const filterByProject = (config.scope === "project");

    switch (command) {
      case "list": {
        // Read todos with scope-based filtering
        const todos = await readTodos({ filterByProject });
        // Add indices
        const todosWithIndices = todos.map((t, i) => ({ ...t, _index: i + 1 }));
        const history = await queryHistory({ filterByProject });
        const category = args[0]; // Optional category filter
        const filteredTodos = category
          ? todosWithIndices.filter((t) => t.category === category)
          : todosWithIndices;
        console.log(await formatTodoList(filteredTodos, category, history));
        break;
      }

      case "add": {
        // Parse flags
        let autoProject = true;
        let projectOverride = null;
        let taskArgs = [...args];

        // Check for --no-auto flag
        const noAutoIndex = args.indexOf('--no-auto');
        if (noAutoIndex !== -1) {
          autoProject = false;
          taskArgs = args.filter((_, i) => i !== noAutoIndex);
        }

        // Check for --project= flag
        const projectFlagIndex = args.findIndex(arg => arg.startsWith('--project='));
        if (projectFlagIndex !== -1) {
          projectOverride = args[projectFlagIndex].split('=')[1];
          taskArgs = args.filter((_, i) => i !== projectFlagIndex);
        }

        const taskString = taskArgs.join(" ");
        if (!taskString) {
          console.error("Error: Please provide a task to add");
          process.exit(1);
        }

        const { todos, added } = await addTodo(taskString, {
          autoProject,
          projectOverride
        });

        // Show display based on current scope
        const displayTodos = await readTodos({ filterByProject });
        const displayWithIndices = displayTodos.map((t, i) => ({ ...t, _index: i + 1 }));
        const history = await queryHistory({ filterByProject });

        let displayText;
        if (added.category && added.subcategory) {
          displayText = `✓ Added [${added.category}/${added.subcategory}]: "${added.task}"`;
        } else if (added.category) {
          displayText = `✓ Added [${added.category}]: "${added.task}"`;
        } else {
          displayText = `✓ Added: "${added.task}"`;
        }

        console.log(displayText);
        console.log(`Total in storage: ${todos.length}`);
        console.log(await formatTodoList(displayWithIndices, null, history));
        break;
      }

      case "remove": {
        const index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1) {
          console.error("Error: Please provide a valid task number");
          process.exit(1);
        }

        try {
          const { todos, removed } = await removeTodo(index, { filterByProject });
          // Display based on current scope
          const displayTodos = await readTodos({ filterByProject });
          const displayWithIndices = displayTodos.map((t, i) => ({ ...t, _index: i + 1 }));
          const history = await queryHistory({ filterByProject });
          console.log(`✓ Removed: "${removed.task}"`);
          console.log(await formatTodoList(displayWithIndices, null, history));
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
          const { todos, completed } = await completeTodo(index, { filterByProject });
          // Display based on current scope
          const displayTodos = await readTodos({ filterByProject });
          const displayWithIndices = displayTodos.map((t, i) => ({ ...t, _index: i + 1 }));
          const history = await queryHistory({ filterByProject });
          const cat = completed.category
            ? completed.subcategory
              ? `[${completed.category}/${completed.subcategory}] `
              : `[${completed.category}] `
            : "";
          console.log(`✓ Completed ${cat}"${completed.task}"`);
          console.log(await formatTodoList(displayWithIndices, null, history));
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case "history": {
        const history = await queryHistory({ filterByProject });
        if (history.length === 0) {
          console.log("No completed todos today.");
        } else {
          const historyText = history
            .map((t, i) => {
              const cat = t.category
                ? t.subcategory
                  ? `[${t.category}/${t.subcategory}] `
                  : `[${t.category}] `
                : "";
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
          const { todos, restored } = await restoreTodo(index, { filterByProject });
          // Display based on current scope
          const displayTodos = await readTodos({ filterByProject });
          const displayWithIndices = displayTodos.map((t, i) => ({ ...t, _index: i + 1 }));
          const history = await queryHistory({ filterByProject });
          const cat = restored.category
            ? restored.subcategory
              ? `[${restored.category}/${restored.subcategory}] `
              : `[${restored.category}] `
            : "";
          console.log(`✓ Restored ${cat}"${restored.task}"`);
          console.log(await formatTodoList(displayWithIndices, null, history));
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case "clear": {
        const count = await clearTodos({ filterByProject });
        const history = await queryHistory({ filterByProject });
        const scope = filterByProject ? "project" : "all";
        console.log(`✓ Cleared ${scope} todos (${count} items removed)`);
        console.log(await formatTodoList([], null, history));
        break;
      }

      case "config": {
        const subcommand = args[0];

        if (!subcommand || subcommand === "show") {
          // Show current configuration
          const projectName = await detectProjectName();
          console.log("Current Configuration:");
          console.log(`  Color Profile: ${config.colorProfile}`);
          console.log(`  Scope: ${config.scope}`);
          console.log(`  ${config.scope === 'project' ? 'Current Project' : 'All Projects'}: ${projectName || '(unknown)'}`);
          console.log("\nNote: All todos stored globally in ~/.tdl/");
          console.log("      Scope controls which todos are displayed");
          console.log("\nAvailable Color Profiles:");
          Object.keys(COLOR_PROFILES).forEach(name => {
            const marker = name === config.colorProfile ? "→" : " ";
            console.log(`  ${marker} ${name} - ${COLOR_PROFILES[name].name}`);
          });
        } else if (subcommand === "color") {
          // Set color profile
          const profileName = args[1];
          if (!profileName) {
            console.error("Error: Please specify a color profile name");
            console.error("Available: " + Object.keys(COLOR_PROFILES).join(", "));
            process.exit(1);
          }
          try {
            await setColorProfile(profileName);
            console.log(`✓ Color profile set to: ${profileName}`);
          } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
          }
        } else if (subcommand === "scope") {
          // Set scope
          const scope = args[1];
          if (!scope) {
            console.error("Error: Please specify scope (project or global)");
            process.exit(1);
          }
          try {
            await setScope(scope);
            const projectName = await detectProjectName();
            console.log(`✓ Display scope set to: ${scope}`);
            console.log(scope === 'global'
              ? 'Now showing todos from all projects'
              : `Now showing todos for: ${projectName || '(current project)'}`);
          } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
          }
        } else {
          console.error(`Unknown config subcommand: ${subcommand}`);
          console.error("Usage:");
          console.error("  cli.js config [show]        - Show current configuration");
          console.error("  cli.js config color <name>  - Set color profile");
          console.error("  cli.js config scope <scope> - Set scope (project or global)");
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error("\nUsage:");
        console.error("  cli.js list [category]       - Show todos (optionally filtered by category)");
        console.error("  cli.js add <task>            - Add a task (use 'cat/subcat::task' for categories)");
        console.error("    Flags:");
        console.error("      --no-auto                - Disable auto project prefix");
        console.error("      --project=<name>         - Override project name");
        console.error("  cli.js complete <index>      - Mark a task as complete (moves to history)");
        console.error("  cli.js remove <index>        - Permanently remove a task (no history)");
        console.error("  cli.js history               - Show completed tasks from today");
        console.error("  cli.js restore <index>       - Restore a task from history");
        console.error("  cli.js clear                 - Clear todos (respects scope setting)");
        console.error("  cli.js config [show]         - Show current configuration");
        console.error("  cli.js config color <name>   - Set color profile");
        console.error("  cli.js config scope <scope>  - Set display scope (project or global)");
        console.error("\nNote: All todos stored globally in ~/.tdl/. Scope controls display only.");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
