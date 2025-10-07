#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  formatTodoList,
  addTodo,
  bulkAdd,
  removeTodo,
  removeTodoById,
  completeTodo,
  completeTodoById,
  clearTodos,
  filterTodos,
  getCategories,
  getStats,
  updateTodo,
  updateTodoById,
  bulkUpdate,
  bulkDelete,
  queryHistory,
  restoreTodo,
  restoreTodoById,
  detectProjectName,
  readTodos,
  findTodoById,
} from "./lib.js";
import {
  readConfig,
  setColorProfile,
  setScope,
  COLOR_PROFILES,
} from "./config.js";

const server = new Server(
  {
    name: "mcp-tdl",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add_todo",
        description:
          "Add a new item to global to-do storage with optional auto-categorization. " +
          "All todos are stored globally in ~/.tdl/. When called from a project directory, " +
          "automatically prepends project name unless task already has a category. " +
          "Supports up to 3 category levels. Stay close to the user's wording. " +
          "Examples: " +
          "'Add feature' → 'myproject::Add feature' (auto), " +
          "'backend::Fix bug' → 'myproject/backend::Fix bug' (auto with 1-level), " +
          "'otherproject/api::Task' → 'otherproject/api::Task' (explicit 2-level, no auto)",
        inputSchema: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "The task to add. Format: 'category::task' or 'category/subcategory::task' (supports up to 3 levels)",
            },
            autoProject: {
              type: "boolean",
              description: "Auto-prepend current project name to untagged or 1-level tasks (default: true)",
            },
            projectOverride: {
              type: "string",
              description: "Explicit project name to use instead of auto-detection",
            },
          },
          required: ["task"],
        },
      },
      {
        name: "bulk_add",
        description:
          "Add multiple todos at once across different projects and categories. " +
          "Useful for adding several tasks in a single operation. " +
          "Each task can be a string (uses default options) or an object with individual options. " +
          "Examples: " +
          "['computer_use/orchestration::Implement queue', 'computer_use/verifier::Validate results'], " +
          "[{task: 'backend::Fix bug', autoProject: false}, {task: 'Add feature', projectOverride: 'myapp'}]",
        inputSchema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              description: "Array of task strings or objects. Objects can have {task, autoProject, projectOverride} properties",
              items: {
                oneOf: [
                  { type: "string" },
                  {
                    type: "object",
                    properties: {
                      task: { type: "string" },
                      autoProject: { type: "boolean" },
                      projectOverride: { type: "string" }
                    },
                    required: ["task"]
                  }
                ]
              },
              minItems: 1,
            },
            defaultOptions: {
              type: "object",
              description: "Default options to apply to all tasks (can be overridden per task)",
              properties: {
                autoProject: {
                  type: "boolean",
                  description: "Auto-prepend project name by default (default: true)"
                },
                projectOverride: {
                  type: "string",
                  description: "Project name to use for all tasks"
                }
              }
            }
          },
          required: ["tasks"],
        },
      },
      {
        name: "get_todos",
        description:
          "Get raw todo data for Claude to inspect silently. Returns JSON array of todos with optional filtering. " +
          "All todos are stored globally. Use filters to view specific subsets. " +
          "Use this when you need to check if tasks exist or query the list without displaying to the user.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by first-level category (e.g., project name)",
            },
            subcategory: {
              type: "string",
              description: "Filter by second-level category (requires category to be set)",
            },
            untagged: {
              type: "boolean",
              description: "Filter for todos without a category (true/false)",
            },
            currentProject: {
              type: "boolean",
              description: "Filter by current project (auto-detected from git/directory)",
            },
            dateFrom: {
              type: "string",
              description: "Filter todos added on or after this date (ISO 8601 format: YYYY-MM-DD)",
            },
            dateTo: {
              type: "string",
              description: "Filter todos added on or before this date (ISO 8601 format: YYYY-MM-DD)",
            },
            searchText: {
              type: "string",
              description: "Filter todos containing this text (case-insensitive search)",
            },
          },
        },
      },
      {
        name: "display_todos",
        description:
          "Display a formatted, pretty-printed todo list to the user. " +
          "Respects the configured scope setting: 'project' shows current project only, 'global' shows all. " +
          "Use this after modifications to show the updated list, or when the user asks to see their todos.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by specific category tag",
            },
            untagged: {
              type: "boolean",
              description: "Filter for todos without a category (true/false)",
            },
          },
        },
      },
      {
        name: "get_metadata",
        description:
          "Get metadata about todos including all unique categories and statistics. Useful for understanding what categories exist and todo distribution.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "update_todo",
        description:
          "Update a single todo's text and/or category by its unique ID. " +
          "Each todo has a unique UUID that never changes, making this operation unambiguous. " +
          "Use get_todos or display_todos to find the ID of the todo you want to update.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique UUID of the todo to update",
            },
            task: {
              type: "string",
              description: "New task text (optional)",
            },
            category: {
              type: ["string", "null"],
              description: "New category tag, or null to remove category (optional)",
            },
            subcategory: {
              type: ["string", "null"],
              description: "New subcategory tag, or null to remove subcategory (optional)",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "bulk_update",
        description:
          "Update multiple todos by specific IDs or filter criteria. " +
          "Use ids array to update specific todos, or filter to match todos by criteria. " +
          "Useful for moving todos between categories or batch editing.",
        inputSchema: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              description: "Array of todo UUIDs to update (alternative to filter)",
              items: { type: "string" },
              minItems: 1,
            },
            filter: {
              type: "object",
              description: "Filter criteria (alternative to ids): category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText",
              properties: {
                category: { type: "string" },
                subcategory: { type: "string" },
                untagged: { type: "boolean" },
                currentProject: { type: "boolean" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                searchText: { type: "string" },
              },
            },
            updates: {
              type: "object",
              description: "Updates to apply to matching todos",
              properties: {
                task: { type: "string" },
                category: { type: ["string", "null"] },
                subcategory: { type: ["string", "null"] },
              },
            },
          },
          required: ["updates"],
        },
      },
      {
        name: "bulk_delete",
        description:
          "Delete multiple todos by specific IDs or filter criteria. " +
          "Use ids array to delete specific todos, or filter to match todos by criteria. " +
          "Useful for cleaning up or removing entire categories.",
        inputSchema: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              description: "Array of todo UUIDs to delete (alternative to filter)",
              items: { type: "string" },
              minItems: 1,
            },
            filter: {
              type: "object",
              description: "Filter criteria (alternative to ids): category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText",
              properties: {
                category: { type: "string" },
                subcategory: { type: "string" },
                untagged: { type: "boolean" },
                currentProject: { type: "boolean" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                searchText: { type: "string" },
              },
            },
          },
        },
      },
      {
        name: "remove_todo",
        description:
          "Remove a single todo by its unique ID. Permanently deletes without saving to history. " +
          "Each todo has a unique UUID that never changes. " +
          "Use get_todos or display_todos to find the ID of the todo you want to remove. " +
          "For bulk operations, use bulk_delete instead.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique UUID of the task to remove",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "complete_todo",
        description:
          "Mark a todo as complete by its unique ID. Moves it to history where it can be viewed today and restored if needed. " +
          "Each todo has a unique UUID that never changes. " +
          "Use get_todos or display_todos to find the ID of the todo you want to complete. " +
          "History clears automatically at midnight.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique UUID of the task to complete",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "query_history",
        description:
          "Query completed todos from today. Respects scope setting: shows current project or all projects. " +
          "History automatically clears at midnight each day.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "restore_todo",
        description:
          "Restore a completed todo from history back to the active list by its unique ID. " +
          "Each todo has a unique UUID that never changes, even when moved to history. " +
          "Use query_history to find the ID of the completed todo you want to restore.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique UUID of the completed task to restore",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "clear_todos",
        description:
          "Clear all todos. Respects scope setting: clears current project only or all projects. " +
          "Use with caution - this cannot be undone.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_config",
        description:
          "Get current TDL configuration (color profile and scope setting). " +
          "Scope controls which todos are DISPLAYED, not where they're stored (all storage is global).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_color_profile",
        description: "Set the color profile for todo list display. Available profiles: default, ocean, forest, sunset, purple, monochrome",
        inputSchema: {
          type: "object",
          properties: {
            profile: {
              type: "string",
              enum: ["default", "ocean", "forest", "sunset", "purple", "monochrome"],
              description: "Color profile name",
            },
          },
          required: ["profile"],
        },
      },
      {
        name: "set_scope",
        description:
          "Set the scope for todo display filtering. " +
          "'project' shows only current project's todos (filtered view). " +
          "'global' shows todos from all projects (unfiltered view). " +
          "Note: All todos are stored globally in ~/.tdl/ regardless of this setting.",
        inputSchema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["project", "global"],
              description: "Display scope: 'project' (current project only) or 'global' (all projects)",
            },
          },
          required: ["scope"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Get config once for all operations that need it
    const config = await readConfig();
    const filterByProject = (config.scope === "project");

    switch (name) {
      case "add_todo": {
        const { todos, added } = await addTodo(args.task, {
          autoProject: args.autoProject !== false, // Default true
          projectOverride: args.projectOverride,
        });

        let displayText;
        if (added.category && added.subcategory) {
          displayText = `Added to-do [${added.category}/${added.subcategory}]: "${added.task}"`;
        } else if (added.category) {
          displayText = `Added to-do [${added.category}]: "${added.task}"`;
        } else {
          displayText = `Added to-do: "${added.task}"`;
        }

        displayText += `\nTotal items in storage: ${todos.length}`;

        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "bulk_add": {
        const { todos, added, count } = await bulkAdd(args.tasks, args.defaultOptions);

        let displayText = `Added ${count} todo${count === 1 ? '' : 's'}:\n`;
        added.forEach((todo, i) => {
          if (todo.category && todo.subcategory) {
            displayText += `${i + 1}. [${todo.category}/${todo.subcategory}] ${todo.task}\n`;
          } else if (todo.category) {
            displayText += `${i + 1}. [${todo.category}] ${todo.task}\n`;
          } else {
            displayText += `${i + 1}. ${todo.task}\n`;
          }
        });

        displayText += `\nTotal items in storage: ${todos.length}`;

        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "get_todos": {
        // Return raw JSON data without formatting
        const filteredTodos = await filterTodos(args || {});

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filteredTodos, null, 2),
            },
          ],
        };
      }

      case "display_todos": {
        // Apply scope-based filtering
        const filterOptions = {
          filterByProject,
          ...args,
        };

        // Read todos with filter applied
        const todos = await readTodos(filterOptions);

        // Add indices for display
        const todosWithIndices = todos.map((t, i) => ({ ...t, _index: i + 1 }));

        // Get history with same filtering
        const history = await queryHistory({ filterByProject });

        return {
          content: [
            {
              type: "text",
              text: await formatTodoList(
                todosWithIndices,
                args?.category || (args?.untagged ? "untagged" : null),
                history,
                { includeIdMap: true }  // Include ID mapping for Claude
              ),
            },
          ],
        };
      }

      case "get_metadata": {
        const categories = await getCategories();
        const stats = await getStats();

        // Add current project info
        const projectName = await detectProjectName();

        const metadata = {
          currentProject: projectName,
          categories,
          stats,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(metadata, null, 2),
            },
          ],
        };
      }

      case "update_todo": {
        const { todos, updated } = await updateTodoById(
          args.id,
          {
            task: args.task,
            category: args.category,
            subcategory: args.subcategory,
          }
        );

        let displayText;
        if (updated.category && updated.subcategory) {
          displayText = `Updated to-do [${updated.category}/${updated.subcategory}]: "${updated.task}"`;
        } else if (updated.category) {
          displayText = `Updated to-do [${updated.category}]: "${updated.task}"`;
        } else {
          displayText = `Updated to-do: "${updated.task}"`;
        }

        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "bulk_update": {
        if (!args.ids && (!args.filter || Object.keys(args.filter).length === 0)) {
          throw new Error("Must provide either ids array or non-empty filter");
        }
        const selector = args.ids ? { ids: args.ids } : { filter: args.filter };
        const { todos, updated, count } = await bulkUpdate(selector, args.updates);

        return {
          content: [
            {
              type: "text",
              text: `Updated ${count} todo(s)\n\nUpdated items:\n${updated
                .map(
                  (t, i) => {
                    const cat = t.category
                      ? t.subcategory
                        ? `[${t.category}/${t.subcategory}] `
                        : `[${t.category}] `
                      : "";
                    return `${i + 1}. ${cat}${t.task}`;
                  }
                )
                .join("\n")}`,
            },
          ],
        };
      }

      case "bulk_delete": {
        if (!args.ids && (!args.filter || Object.keys(args.filter).length === 0)) {
          throw new Error("Must provide either ids array or non-empty filter");
        }
        const selector = args.ids ? { ids: args.ids } : { filter: args.filter };
        const { todos, deleted, count } = await bulkDelete(selector);

        return {
          content: [
            {
              type: "text",
              text: `Deleted ${count} todo(s)\n\nDeleted items:\n${deleted
                .map(
                  (t, i) => {
                    const cat = t.category
                      ? t.subcategory
                        ? `[${t.category}/${t.subcategory}] `
                        : `[${t.category}] `
                      : "";
                    return `${i + 1}. ${cat}${t.task}`;
                  }
                )
                .join("\n")}\n\nRemaining todos: ${todos.length}`,
            },
          ],
        };
      }

      case "remove_todo": {
        const { todos, removed } = await removeTodoById(args.id);
        return {
          content: [
            {
              type: "text",
              text: `Removed to-do: "${removed.task}"\nRemaining items: ${todos.length}`,
            },
          ],
        };
      }

      case "complete_todo": {
        const { todos, completed } = await completeTodoById(args.id);
        const cat = completed.category
          ? completed.subcategory
            ? `[${completed.category}/${completed.subcategory}] `
            : `[${completed.category}] `
          : "";
        const displayText = `✓ Completed ${cat}"${completed.task}"\nRemaining items: ${todos.length}`;
        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "query_history": {
        const history = await queryHistory({ filterByProject });
        if (history.length === 0) {
          return {
            content: [
              { type: "text", text: "No completed todos today." },
            ],
          };
        }

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
            return `${i + 1}. ${cat}${t.task}\n   Completed: ${time}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: "text",
              text: `✓ Completed Today (${history.length}):\n\n${historyText}`,
            },
          ],
        };
      }

      case "restore_todo": {
        const { todos, restored } = await restoreTodoById(args.id);
        const cat = restored.category
          ? restored.subcategory
            ? `[${restored.category}/${restored.subcategory}] `
            : `[${restored.category}] `
          : "";
        const displayText = `Restored ${cat}"${restored.task}"\nActive items: ${todos.length}`;
        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "clear_todos": {
        const previousCount = await clearTodos({ filterByProject });
        const scope = filterByProject ? "project" : "all";
        return {
          content: [
            {
              type: "text",
              text: `Cleared ${scope} to-dos (${previousCount} items removed)`,
            },
          ],
        };
      }

      case "get_config": {
        const profiles = Object.keys(COLOR_PROFILES).map(name => ({
          name,
          description: COLOR_PROFILES[name].name,
          current: name === config.colorProfile
        }));

        const projectName = await detectProjectName();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                colorProfile: config.colorProfile,
                scope: config.scope,
                scopeDescription: config.scope === 'project'
                  ? `Showing todos for current project: ${projectName || '(unknown)'}`
                  : 'Showing todos from all projects',
                availableProfiles: profiles,
                note: 'All todos are stored globally in ~/.tdl/. Scope controls which todos are displayed.'
              }, null, 2),
            },
          ],
        };
      }

      case "set_color_profile": {
        await setColorProfile(args.profile);
        return {
          content: [
            {
              type: "text",
              text: `✓ Color profile set to: ${args.profile}`,
            },
          ],
        };
      }

      case "set_scope": {
        await setScope(args.scope);
        const projectName = await detectProjectName();
        return {
          content: [
            {
              type: "text",
              text: `✓ Display scope set to: ${args.scope}\n${
                args.scope === 'global'
                  ? 'Now showing todos from all projects'
                  : `Now showing todos for: ${projectName || '(current project)'}`
              }\nNote: All todos are stored globally in ~/.tdl/ regardless of this setting.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
