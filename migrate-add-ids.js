#!/usr/bin/env node
/**
 * Migration script: Add unique IDs to existing todos
 *
 * This script adds UUID fields to all existing todos that don't have them.
 * Safe to run multiple times - skips todos that already have IDs.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { CONFIG_DIR } from "./config.js";

const TODO_FILE = "todos.json";
const HISTORY_FILE = "todos-history.json";

async function migrateFile(filePath, fileType) {
  let data;
  try {
    const content = await fs.readFile(filePath, "utf-8");
    data = JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`  • No ${fileType} file found (${path.basename(filePath)})`);
      return { migrated: 0, skipped: 0 };
    }
    throw error;
  }

  let migrated = 0;
  let skipped = 0;

  // Handle different file formats
  let todos = [];
  if (fileType === "history") {
    if (!data.completed) {
      console.log(`  • History file has no completed array`);
      return { migrated: 0, skipped: 0 };
    }
    todos = data.completed;
  } else {
    todos = data;
  }

  // Add IDs to todos that don't have them
  for (const todo of todos) {
    if (!todo.id) {
      todo.id = randomUUID();
      migrated++;
    } else {
      skipped++;
    }
  }

  // Write back
  if (migrated > 0) {
    if (fileType === "history") {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else {
      await fs.writeFile(filePath, JSON.stringify(todos, null, 2));
    }
  }

  return { migrated, skipped };
}

async function main() {
  console.log("🔄 Adding unique IDs to existing todos...\n");

  const todoPath = path.join(CONFIG_DIR, TODO_FILE);
  const historyPath = path.join(CONFIG_DIR, HISTORY_FILE);

  // Migrate active todos
  console.log("Processing active todos:");
  const todoResult = await migrateFile(todoPath, "active");
  if (todoResult.migrated > 0) {
    console.log(`  ✓ Added IDs to ${todoResult.migrated} todos`);
  }
  if (todoResult.skipped > 0) {
    console.log(`  ✓ Skipped ${todoResult.skipped} todos (already have IDs)`);
  }

  console.log();

  // Migrate history
  console.log("Processing history:");
  const historyResult = await migrateFile(historyPath, "history");
  if (historyResult.migrated > 0) {
    console.log(`  ✓ Added IDs to ${historyResult.migrated} completed todos`);
  }
  if (historyResult.skipped > 0) {
    console.log(`  ✓ Skipped ${historyResult.skipped} completed todos (already have IDs)`);
  }

  console.log();

  const totalMigrated = todoResult.migrated + historyResult.migrated;
  const totalSkipped = todoResult.skipped + historyResult.skipped;

  if (totalMigrated > 0) {
    console.log("✅ Migration complete!");
    console.log(`\n  • Added IDs to ${totalMigrated} todos`);
    if (totalSkipped > 0) {
      console.log(`  • ${totalSkipped} todos already had IDs`);
    }
    console.log("\nAll todos now have unique UUIDs for unambiguous operations.");
  } else if (totalSkipped > 0) {
    console.log("✅ All todos already have IDs!");
    console.log(`\n  • ${totalSkipped} todos checked`);
  } else {
    console.log("✅ No todos found to migrate.");
  }

  console.log("\nYou can now use ID-based operations via MCP tools:");
  console.log("  • update_todo({ id: '...', ... })");
  console.log("  • complete_todo({ id: '...' })");
  console.log("  • remove_todo({ id: '...' })");
  console.log("  • restore_todo({ id: '...' })");
}

main().catch(error => {
  console.error("\n❌ Migration failed:", error.message);
  console.error("\nStack trace:", error.stack);
  process.exit(1);
});
