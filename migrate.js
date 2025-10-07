#!/usr/bin/env node
/**
 * Migration script: Project-local storage → Global-only storage
 *
 * This script migrates todos from the old dual-storage architecture
 * (project-local + global) to the new global-only architecture.
 *
 * What it does:
 * 1. Finds project-local todo files (.project-todos.json)
 * 2. Transforms todos by prepending project name as category
 * 3. Merges into global storage (~/.tdl/todos.json)
 * 4. Backs up and removes old files
 */

import fs from "fs/promises";
import path from "path";
import { CONFIG_DIR } from "./config.js";
import { detectProjectName } from "./lib.js";

const PROJECT_TODO_FILE = ".project-todos.json";
const PROJECT_HISTORY_FILE = ".project-todos-history.json";
const OLD_GLOBAL_TODO_FILE = ".global-todos.json";
const OLD_GLOBAL_HISTORY_FILE = ".global-todos-history.json";
const NEW_TODO_FILE = "todos.json";
const NEW_HISTORY_FILE = "todos-history.json";

async function migrate() {
  console.log("🔄 Migrating TDL to global-only storage...\n");

  // 1. Check for existing project todos in current directory
  const projectTodosPath = path.join(process.cwd(), PROJECT_TODO_FILE);
  const projectHistoryPath = path.join(process.cwd(), PROJECT_HISTORY_FILE);

  let projectTodos = [];
  let projectHistory = { completed: [], lastCleared: new Date().toISOString() };

  try {
    projectTodos = JSON.parse(await fs.readFile(projectTodosPath, "utf-8"));
    console.log(`✓ Found ${projectTodos.length} project todos in current directory`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log("  No project todos found in current directory");
  }

  try {
    projectHistory = JSON.parse(await fs.readFile(projectHistoryPath, "utf-8"));
    const completedCount = projectHistory.completed?.length || 0;
    if (completedCount > 0) {
      console.log(`✓ Found ${completedCount} completed todos in project history`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // 2. Load existing global todos (both old and new locations)
  const oldGlobalTodosPath = path.join(CONFIG_DIR, OLD_GLOBAL_TODO_FILE);
  const oldGlobalHistoryPath = path.join(CONFIG_DIR, OLD_GLOBAL_HISTORY_FILE);
  const newGlobalTodosPath = path.join(CONFIG_DIR, NEW_TODO_FILE);
  const newGlobalHistoryPath = path.join(CONFIG_DIR, NEW_HISTORY_FILE);

  let globalTodos = [];
  let globalHistory = { completed: [], lastCleared: new Date().toISOString() };

  // Try new location first, then old location
  try {
    globalTodos = JSON.parse(await fs.readFile(newGlobalTodosPath, "utf-8"));
    console.log(`✓ Found ${globalTodos.length} todos in new global storage`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // Try old location
    try {
      globalTodos = JSON.parse(await fs.readFile(oldGlobalTodosPath, "utf-8"));
      console.log(`✓ Found ${globalTodos.length} todos in old global storage (will migrate)`);
    } catch (error2) {
      if (error2.code !== "ENOENT") throw error2;
      console.log("  No existing global todos found");
    }
  }

  try {
    globalHistory = JSON.parse(await fs.readFile(newGlobalHistoryPath, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // Try old location
    try {
      globalHistory = JSON.parse(await fs.readFile(oldGlobalHistoryPath, "utf-8"));
    } catch (error2) {
      if (error2.code !== "ENOENT") throw error2;
    }
  }

  // 3. Migrate project todos to global with project prefix
  let migratedCount = 0;
  if (projectTodos.length > 0 || projectHistory.completed?.length > 0) {
    const projectName = await detectProjectName();
    console.log(`\n📦 Migrating with project prefix: ${projectName}`);

    // Transform active todos
    for (const todo of projectTodos) {
      const migrated = {
        ...todo,
        // Transform: category → subcategory, projectName → category
        subcategory: todo.category,
        category: projectName
      };
      globalTodos.push(migrated);
      migratedCount++;
    }

    if (migratedCount > 0) {
      console.log(`✓ Migrated ${migratedCount} active todos`);
    }

    // Transform history
    let historyMigrated = 0;
    if (projectHistory.completed?.length > 0) {
      for (const todo of projectHistory.completed) {
        const migrated = {
          ...todo,
          subcategory: todo.category,
          category: projectName
        };
        globalHistory.completed.push(migrated);
        historyMigrated++;
      }
      console.log(`✓ Migrated ${historyMigrated} completed todos to history`);
    }
  }

  // 4. Write merged global todos to new location
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(newGlobalTodosPath, JSON.stringify(globalTodos, null, 2));
  await fs.writeFile(newGlobalHistoryPath, JSON.stringify(globalHistory, null, 2));

  console.log(`\n✓ Wrote ${globalTodos.length} todos to global storage: ${newGlobalTodosPath}`);

  // 5. Backup and remove old files
  let removedFiles = [];

  if (projectTodos.length > 0) {
    const backupPath = projectTodosPath + ".backup";
    await fs.copyFile(projectTodosPath, backupPath);
    await fs.unlink(projectTodosPath);
    console.log(`\n✓ Backed up project todos to: ${backupPath}`);
    console.log(`✓ Removed: ${projectTodosPath}`);
    removedFiles.push(PROJECT_TODO_FILE);
  }

  if (projectHistory.completed?.length > 0) {
    const backupPath = projectHistoryPath + ".backup";
    await fs.copyFile(projectHistoryPath, backupPath);
    await fs.unlink(projectHistoryPath);
    console.log(`✓ Backed up project history to: ${backupPath}`);
    console.log(`✓ Removed: ${projectHistoryPath}`);
    removedFiles.push(PROJECT_HISTORY_FILE);
  }

  // Remove old global files if they exist and we've migrated to new location
  try {
    const oldExists = await fs.access(oldGlobalTodosPath).then(() => true).catch(() => false);
    if (oldExists) {
      await fs.rename(oldGlobalTodosPath, oldGlobalTodosPath + ".old");
      console.log(`\n✓ Renamed old global file: ${OLD_GLOBAL_TODO_FILE} → ${OLD_GLOBAL_TODO_FILE}.old`);
    }
  } catch (error) {
    // Ignore errors
  }

  try {
    const oldExists = await fs.access(oldGlobalHistoryPath).then(() => true).catch(() => false);
    if (oldExists) {
      await fs.rename(oldGlobalHistoryPath, oldGlobalHistoryPath + ".old");
      console.log(`✓ Renamed old global history: ${OLD_GLOBAL_HISTORY_FILE} → ${OLD_GLOBAL_HISTORY_FILE}.old`);
    }
  } catch (error) {
    // Ignore errors
  }

  // 6. Summary
  console.log("\n✅ Migration complete!\n");

  if (migratedCount > 0 || removedFiles.length > 0) {
    console.log("Summary:");
    if (migratedCount > 0) {
      console.log(`  • Migrated ${migratedCount} project-local todos to global storage`);
    }
    if (removedFiles.length > 0) {
      console.log(`  • Removed old files: ${removedFiles.join(", ")}`);
      console.log(`  • Backups created with .backup extension`);
    }
    console.log("\nNext steps:");
    console.log("  1. Test with: node cli.js list");
    console.log("  2. Verify todos are displayed correctly");
    console.log("  3. Remove .backup files when satisfied: rm .project-todos.json.backup");
  } else {
    console.log("No migration needed - no project-local todos found.");
    console.log("You're already using the new global-only storage!");
  }

  console.log("\nNew architecture:");
  console.log("  • All todos stored in: ~/.tdl/todos.json");
  console.log("  • Scope setting controls display filter (project vs global view)");
  console.log("  • Run 'node cli.js config show' to see current settings");
}

migrate().catch(error => {
  console.error("\n❌ Migration failed:", error.message);
  console.error("\nStack trace:", error.stack);
  console.error("\nYour todos are safe. No files have been modified.");
  process.exit(1);
});
