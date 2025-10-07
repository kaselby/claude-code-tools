#!/usr/bin/env node
/**
 * Migrate all project-local todos to global storage
 *
 * This script finds all .project-todos.json files across multiple projects
 * and migrates them to the new global-only storage architecture.
 */

import fs from "fs/promises";
import path from "path";
import { CONFIG_DIR } from "./config.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEW_TODO_FILE = "todos.json";
const NEW_HISTORY_FILE = "todos-history.json";

// Projects to migrate
const PROJECTS = [
  { path: "/Users/kaselby/Git/claude-tools/tdl", name: "tdl" },
  { path: "/Users/kaselby/Git/claude-tools/safeclaude", name: "safeclaude" },
  { path: "/Users/kaselby/Git/computer_use", name: "computer_use" },
];

/**
 * Parse category string that might have :: delimiter
 * "computer_use::general" → { parts: ["computer_use", "general"] }
 */
function parseCategory(catString) {
  if (!catString) return { parts: [] };

  // Handle old format with :: delimiter
  if (catString.includes("::")) {
    const parts = catString.split("::").map(p => p.trim());
    return { parts };
  }

  // Regular format
  return { parts: [catString] };
}

/**
 * Transform a project-local todo for global storage
 */
function transformTodo(todo, projectName) {
  // If category is null/undefined, just add project name
  if (!todo.category) {
    return {
      ...todo,
      category: projectName,
      subcategory: null
    };
  }

  // Parse the category (might have :: format)
  const parsed = parseCategory(todo.category);

  // Check if it already starts with the project name
  if (parsed.parts.length > 0 && parsed.parts[0] === projectName) {
    // Already has project name, just restructure
    return {
      ...todo,
      category: parsed.parts[0],
      subcategory: parsed.parts.slice(1).join("/") || todo.subcategory || null
    };
  }

  // If category is something else, make it a subcategory under project
  if (parsed.parts.length === 1) {
    // Single part: "enhanced" → "tdl/enhanced"
    return {
      ...todo,
      category: projectName,
      subcategory: parsed.parts[0]
    };
  } else {
    // Multiple parts: "computer_use::general" → "computer_use/general"
    return {
      ...todo,
      category: parsed.parts[0],
      subcategory: parsed.parts.slice(1).join("/")
    };
  }
}

async function migrateProject(project) {
  const todosPath = path.join(project.path, ".project-todos.json");
  const historyPath = path.join(project.path, ".project-todos-history.json");

  let todos = [];
  let history = { completed: [], lastCleared: new Date().toISOString() };

  // Read project todos
  try {
    todos = JSON.parse(await fs.readFile(todosPath, "utf-8"));
    console.log(`  ✓ Found ${todos.length} todos in ${project.name}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log(`  • No todos found in ${project.name}`);
    return { todos: [], history };
  }

  // Read project history
  try {
    history = JSON.parse(await fs.readFile(historyPath, "utf-8"));
    if (history.completed?.length > 0) {
      console.log(`  ✓ Found ${history.completed.length} completed todos in ${project.name} history`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // Transform todos
  const transformedTodos = todos.map(todo => transformTodo(todo, project.name));
  const transformedHistory = {
    ...history,
    completed: (history.completed || []).map(todo => transformTodo(todo, project.name))
  };

  return { todos: transformedTodos, history: transformedHistory, originalPaths: { todosPath, historyPath } };
}

async function main() {
  console.log("🔄 Migrating all project todos to global storage...\n");

  // Load existing global todos
  const globalTodosPath = path.join(CONFIG_DIR, NEW_TODO_FILE);
  const globalHistoryPath = path.join(CONFIG_DIR, NEW_HISTORY_FILE);

  let globalTodos = [];
  let globalHistory = { completed: [], lastCleared: new Date().toISOString() };

  try {
    globalTodos = JSON.parse(await fs.readFile(globalTodosPath, "utf-8"));
    console.log(`📦 Existing global storage has ${globalTodos.length} todos\n`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log("📦 Creating new global storage\n");
  }

  try {
    globalHistory = JSON.parse(await fs.readFile(globalHistoryPath, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // Migrate each project
  let totalMigrated = 0;
  let totalHistoryMigrated = 0;
  const filesToBackup = [];

  for (const project of PROJECTS) {
    console.log(`📁 Processing ${project.name}:`);
    const result = await migrateProject(project);

    if (result.todos.length > 0) {
      globalTodos.push(...result.todos);
      totalMigrated += result.todos.length;
      console.log(`  → Migrated ${result.todos.length} todos`);

      if (result.originalPaths) {
        filesToBackup.push({
          original: result.originalPaths.todosPath,
          backup: result.originalPaths.todosPath + ".backup"
        });
      }
    }

    if (result.history.completed?.length > 0) {
      globalHistory.completed.push(...result.history.completed);
      totalHistoryMigrated += result.history.completed.length;
      console.log(`  → Migrated ${result.history.completed.length} completed todos`);

      if (result.originalPaths) {
        filesToBackup.push({
          original: result.originalPaths.historyPath,
          backup: result.originalPaths.historyPath + ".backup"
        });
      }
    }

    console.log();
  }

  // Write merged global todos
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(globalTodosPath, JSON.stringify(globalTodos, null, 2));
  await fs.writeFile(globalHistoryPath, JSON.stringify(globalHistory, null, 2));

  console.log(`✅ Migration complete!\n`);
  console.log(`Summary:`);
  console.log(`  • Total active todos migrated: ${totalMigrated}`);
  console.log(`  • Total completed todos migrated: ${totalHistoryMigrated}`);
  console.log(`  • Global storage now has: ${globalTodos.length} active todos`);
  console.log(`  • Location: ${globalTodosPath}\n`);

  // Backup and remove old files
  if (filesToBackup.length > 0) {
    console.log("🗄️  Backing up old files:");
    for (const { original, backup } of filesToBackup) {
      try {
        await fs.copyFile(original, backup);
        await fs.unlink(original);
        console.log(`  ✓ Backed up and removed: ${path.basename(original)}`);
      } catch (error) {
        console.log(`  ⚠ Could not backup ${path.basename(original)}: ${error.message}`);
      }
    }
    console.log();
  }

  console.log("Next steps:");
  console.log("  1. View todos: node cli.js list");
  console.log("  2. Switch to global view: node cli.js config scope global");
  console.log("  3. Verify migration looks correct");
  console.log("  4. Remove .backup files when satisfied");
  console.log("\nTo view todos by project:");
  console.log("  • node cli.js config scope project");
  console.log("  • cd to each project directory and run: node cli.js list");
}

main().catch(error => {
  console.error("\n❌ Migration failed:", error.message);
  console.error("\nStack trace:", error.stack);
  console.error("\nYour todos are safe in their original locations.");
  process.exit(1);
});
