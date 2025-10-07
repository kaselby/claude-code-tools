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
  removeTodoById,
  completeTodoById,
  clearTodos,
  filterTodos,
  getCategories,
  getStats,
  updateTodoById,
  bulkUpdate,
  bulkDelete,
  queryHistory,
  restoreTodoById,
  detectProjectName,
  readTodos,
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
        name: "add_todos",
        description:
          "Add one or more todos to global storage with optional auto-categorization. " +
          "Accepts a single task string, array of strings, or array of task objects. " +
          "When called from a project directory, automatically prepends project name unless disabled. " +
          "Examples: " +
          "Single: 'Fix bug' → 'myproject::Fix bug' (auto), " +
          "Array: ['Fix bug', 'backend::Add feature'] → ['myproject::Fix bug', 'myproject/backend::Add feature'], " +
          "Objects: [{task: 'Fix bug', autoProject: false}, {task: 'Add test', projectOverride: 'other'}]",
        inputSchema: {
          type: "object",
          properties: {
            tasks: {
              oneOf: [
                { type: "string" },
                {
                  type: "array",
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
                }
              ],
              description: "Task string, array of strings, or array of task objects with {task, autoProject, projectOverride}"
            },
            autoProject: {
              type: "boolean",
              description: "Default: auto-prepend project name (default: true, applies to all tasks if not overridden)"
            },
            projectOverride: {
              type: "string",
              description: "Explicit project name to use for all tasks (unless individually overridden)"
            },
          },
          required: ["tasks"],
        },
      },
      {
        name: "remove_todos",
        description:
          "Remove one or more todos permanently (no history). " +
          "Accepts single ID, array of IDs, or filter criteria. " +
          "Examples: " +
          "Single: { id: 'uuid' }, " +
          "Multiple: { ids: ['uuid1', 'uuid2'] }, " +
          "Filter: { filter: { category: 'backend' } }",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Single todo UUID to remove"
            },
            ids: {
              type: "array",
              items: { type: "string" },
              description: "Array of todo UUIDs to remove",
              minItems: 1,
            },
            filter: {
              type: "object",
              description: "Filter criteria: category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText",
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
        name: "complete_todos",
        description:
          "Mark one or more todos as complete (moves to history, viewable until midnight). " +
          "Accepts single ID, array of IDs, or filter criteria. " +
          "Examples: " +
          "Single: { id: 'uuid' }, " +
          "Multiple: { ids: ['uuid1', 'uuid2'] }, " +
          "Filter: { filter: { category: 'done' } }",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Single todo UUID to complete"
            },
            ids: {
              type: "array",
              items: { type: "string" },
              description: "Array of todo UUIDs to complete",
              minItems: 1,
            },
            filter: {
              type: "object",
              description: "Filter criteria: category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText",
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
        name: "update_todos",
        description:
          "Update one or more todos' text and/or categories. " +
          "Accepts single ID, array of IDs, or filter criteria, plus updates to apply. " +
          "Examples: " +
          "Single: { id: 'uuid', updates: { task: 'New text' } }, " +
          "Multiple: { ids: ['uuid1', 'uuid2'], updates: { category: 'backend' } }, " +
          "Filter: { filter: { category: 'old' }, updates: { category: 'new' } }",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Single todo UUID to update"
            },
            ids: {
              type: "array",
              items: { type: "string" },
              description: "Array of todo UUIDs to update",
              minItems: 1,
            },
            filter: {
              type: "object",
              description: "Filter criteria: category, subcategory, untagged, currentProject, dateFrom, dateTo, searchText",
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
        name: "query_todos",
        description:
          "Query raw todo data with optional filters and metadata. " +
          "Returns JSON array of todos. Use includeMetadata for categories and statistics. " +
          "Use this to silently check if tasks exist without displaying to the user.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by first-level category (e.g., project name)",
            },
            subcategory: {
              type: "string",
              description: "Filter by second-level category",
            },
            untagged: {
              type: "boolean",
              description: "Filter for todos without a category",
            },
            currentProject: {
              type: "boolean",
              description: "Filter by current project (auto-detected)",
            },
            dateFrom: {
              type: "string",
              description: "Filter todos added on/after this date (ISO 8601: YYYY-MM-DD)",
            },
            dateTo: {
              type: "string",
              description: "Filter todos added on/before this date (ISO 8601: YYYY-MM-DD)",
            },
            searchText: {
              type: "string",
              description: "Filter todos containing this text (case-insensitive)",
            },
            includeMetadata: {
              type: "boolean",
              description: "Include categories, stats, and current project info (default: false)",
            },
          },
        },
      },
      {
        name: "display_todos",
        description:
          "Display formatted, pretty-printed todo list to the user. " +
          "Respects scope setting: 'project' shows current project only, 'global' shows all. " +
          "Use this after modifications to show the updated list.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by specific category",
            },
            untagged: {
              type: "boolean",
              description: "Filter for todos without a category",
            },
          },
        },
      },
      {
        name: "query_history",
        description:
          "View completed todos from today. Respects scope setting. " +
          "History clears automatically at midnight.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "restore_todos",
        description:
          "Restore one or more completed todos from history back to active list. " +
          "Accepts single ID, array of IDs, or filter criteria. " +
          "Examples: " +
          "Single: { id: 'uuid' }, " +
          "Multiple: { ids: ['uuid1', 'uuid2'] }, " +
          "Filter: { filter: { category: 'backend' } }",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Single todo UUID to restore"
            },
            ids: {
              type: "array",
              items: { type: "string" },
              description: "Array of todo UUIDs to restore",
              minItems: 1,
            },
            filter: {
              type: "object",
              description: "Filter criteria: category, subcategory, untagged, dateFrom, dateTo, searchText",
              properties: {
                category: { type: "string" },
                subcategory: { type: "string" },
                untagged: { type: "boolean" },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                searchText: { type: "string" },
              },
            },
          },
        },
      },
      {
        name: "clear_todos",
        description:
          "Clear all todos. Respects scope setting: clears current project only or all projects. " +
          "Use with caution - cannot be undone.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_config",
        description:
          "Get current configuration (color profile, scope setting). " +
          "Scope controls which todos are DISPLAYED, not where they're stored (all storage is global).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_color_profile",
        description: "Set color profile for display. Profiles: default, ocean, forest, sunset, purple, monochrome",
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
          "Set display scope. 'project' shows current project only, 'global' shows all. " +
          "All todos stored globally in ~/.tdl/ regardless of setting.",
        inputSchema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["project", "global"],
              description: "Display scope",
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
    const config = await readConfig();
    const filterByProject = (config.scope === "project");

    switch (name) {
      case "add_todos": {
        // Handle single string, array of strings, or array of objects
        const tasks = typeof args.tasks === 'string' ? [args.tasks] : args.tasks;
        const defaultOptions = {
          autoProject: args.autoProject !== false,
          projectOverride: args.projectOverride,
        };

        const { todos, added, count } = await bulkAdd(tasks, defaultOptions);

        if (count === 1) {
          const todo = added[0];
          const cat = todo.category && todo.subcategory
            ? `[${todo.category}/${todo.subcategory}] `
            : todo.category
              ? `[${todo.category}] `
              : "";
          return {
            content: [{
              type: "text",
              text: `Added ${cat}"${todo.task}"\nTotal items in storage: ${todos.length}`
            }],
          };
        } else {
          let text = `Added ${count} todos:\n`;
          added.forEach((t, i) => {
            const cat = t.category && t.subcategory
              ? `[${t.category}/${t.subcategory}] `
              : t.category
                ? `[${t.category}] `
                : "";
            text += `${i + 1}. ${cat}${t.task}\n`;
          });
          text += `\nTotal items in storage: ${todos.length}`;
          return {
            content: [{ type: "text", text }],
          };
        }
      }

      case "remove_todos": {
        // Convert single id/ids/filter to unified selector
        let selector;
        if (args.id) {
          selector = { ids: [args.id] };
        } else if (args.ids) {
          if (args.ids.length === 0) {
            throw new Error("ids array cannot be empty");
          }
          selector = { ids: args.ids };
        } else if (args.filter) {
          if (Object.keys(args.filter).length === 0) {
            throw new Error("filter must contain at least one criteria");
          }
          selector = { filter: args.filter };
        } else {
          throw new Error("Must provide id, ids array, or filter");
        }

        const { todos, deleted, count } = await bulkDelete(selector);

        if (count === 1) {
          return {
            content: [{
              type: "text",
              text: `Removed "${deleted[0].task}"\nRemaining items: ${todos.length}`
            }],
          };
        } else {
          let text = `Removed ${count} todos:\n`;
          deleted.forEach((t, i) => {
            const cat = t.category && t.subcategory
              ? `[${t.category}/${t.subcategory}] `
              : t.category
                ? `[${t.category}] `
                : "";
            text += `${i + 1}. ${cat}${t.task}\n`;
          });
          text += `\nRemaining items: ${todos.length}`;
          return {
            content: [{ type: "text", text }],
          };
        }
      }

      case "complete_todos": {
        // Convert single id/ids/filter to unified operations
        let idsToComplete;
        if (args.id) {
          idsToComplete = [args.id];
        } else if (args.ids) {
          if (args.ids.length === 0) {
            throw new Error("ids array cannot be empty");
          }
          idsToComplete = args.ids;
        } else if (args.filter) {
          if (Object.keys(args.filter).length === 0) {
            throw new Error("filter must contain at least one criteria");
          }
          // Get todos matching filter
          const matchingTodos = await filterTodos(args.filter);
          idsToComplete = matchingTodos.map(t => t.id);
        } else {
          throw new Error("Must provide id, ids array, or filter");
        }

        if (idsToComplete.length === 0) {
          return {
            content: [{ type: "text", text: "No todos matched the criteria" }],
          };
        }

        // Complete each todo
        const completed = [];
        for (const id of idsToComplete) {
          const result = await completeTodoById(id);
          completed.push(result.completed);
        }

        const todos = await readTodos();

        if (completed.length === 1) {
          const todo = completed[0];
          const cat = todo.category && todo.subcategory
            ? `[${todo.category}/${todo.subcategory}] `
            : todo.category
              ? `[${todo.category}] `
              : "";
          return {
            content: [{
              type: "text",
              text: `✓ Completed ${cat}"${todo.task}"\nRemaining items: ${todos.length}`
            }],
          };
        } else {
          let text = `✓ Completed ${completed.length} todos:\n`;
          completed.forEach((t, i) => {
            const cat = t.category && t.subcategory
              ? `[${t.category}/${t.subcategory}] `
              : t.category
                ? `[${t.category}] `
                : "";
            text += `${i + 1}. ${cat}${t.task}\n`;
          });
          text += `\nRemaining items: ${todos.length}`;
          return {
            content: [{ type: "text", text }],
          };
        }
      }

      case "update_todos": {
        // Convert single id/ids/filter to unified selector
        let selector;
        if (args.id) {
          selector = { ids: [args.id] };
        } else if (args.ids) {
          if (args.ids.length === 0) {
            throw new Error("ids array cannot be empty");
          }
          selector = { ids: args.ids };
        } else if (args.filter) {
          if (Object.keys(args.filter).length === 0) {
            throw new Error("filter must contain at least one criteria");
          }
          selector = { filter: args.filter };
        } else {
          throw new Error("Must provide id, ids array, or filter");
        }

        const { todos, updated, count } = await bulkUpdate(selector, args.updates);

        if (count === 1) {
          const todo = updated[0];
          const cat = todo.category && todo.subcategory
            ? `[${todo.category}/${todo.subcategory}] `
            : todo.category
              ? `[${todo.category}] `
              : "";
          return {
            content: [{
              type: "text",
              text: `Updated ${cat}"${todo.task}"`
            }],
          };
        } else {
          let text = `Updated ${count} todos:\n`;
          updated.forEach((t, i) => {
            const cat = t.category && t.subcategory
              ? `[${t.category}/${t.subcategory}] `
              : t.category
                ? `[${t.category}] `
                : "";
            text += `${i + 1}. ${cat}${t.task}\n`;
          });
          return {
            content: [{ type: "text", text }],
          };
        }
      }

      case "query_todos": {
        const filteredTodos = await filterTodos(args || {});

        if (args.includeMetadata) {
          const categories = await getCategories();
          const stats = await getStats();
          const projectName = await detectProjectName();

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                todos: filteredTodos,
                metadata: {
                  currentProject: projectName,
                  categories,
                  stats,
                }
              }, null, 2),
            }],
          };
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(filteredTodos, null, 2),
            }],
          };
        }
      }

      case "display_todos": {
        const filterOptions = { filterByProject, ...args };
        const todos = await readTodos(filterOptions);
        const todosWithIndices = todos.map((t, i) => ({ ...t, _index: i + 1 }));
        const history = await queryHistory({ filterByProject });

        return {
          content: [{
            type: "text",
            text: await formatTodoList(
              todosWithIndices,
              args?.category || (args?.untagged ? "untagged" : null),
              history,
              { includeIdMap: true }
            ),
          }],
        };
      }

      case "query_history": {
        const history = await queryHistory({ filterByProject });
        if (history.length === 0) {
          return {
            content: [{ type: "text", text: "No completed todos today." }],
          };
        }

        const historyText = history
          .map((t, i) => {
            const cat = t.category && t.subcategory
              ? `[${t.category}/${t.subcategory}] `
              : t.category
                ? `[${t.category}] `
                : "";
            const time = new Date(t.completedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
            return `${i + 1}. ${cat}${t.task}\n   Completed: ${time}`;
          })
          .join('\n\n');

        return {
          content: [{
            type: "text",
            text: `✓ Completed Today (${history.length}):\n\n${historyText}`,
          }],
        };
      }

      case "restore_todos": {
        // Convert single id/ids/filter to unified operations
        let idsToRestore;
        if (args.id) {
          idsToRestore = [args.id];
        } else if (args.ids) {
          if (args.ids.length === 0) {
            throw new Error("ids array cannot be empty");
          }
          idsToRestore = args.ids;
        } else if (args.filter) {
          if (Object.keys(args.filter).length === 0) {
            throw new Error("filter must contain at least one criteria");
          }
          // Get all completed todos (not filtered by project yet - we'll apply filter below)
          const allHistory = await queryHistory({ filterByProject: false });

          // Apply filters using same logic as filterTodos() in lib.js
          // NOTE: Keep this in sync with filterTodos() implementation
          let matchingTodos = allHistory;

          // Current project filter
          if (args.filter.currentProject) {
            const projectName = await detectProjectName();
            if (projectName) {
              matchingTodos = matchingTodos.filter(t => t.category === projectName);
            }
          }

          // Category filters
          if (args.filter.category) {
            matchingTodos = matchingTodos.filter(t => t.category === args.filter.category);
          }
          if (args.filter.subcategory) {
            matchingTodos = matchingTodos.filter(t => t.subcategory === args.filter.subcategory);
          }
          if (args.filter.untagged === true) {
            matchingTodos = matchingTodos.filter(t => !t.category);
          }

          // Date filters
          if (args.filter.dateFrom) {
            const fromDate = new Date(args.filter.dateFrom);
            matchingTodos = matchingTodos.filter(t => new Date(t.added) >= fromDate);
          }
          if (args.filter.dateTo) {
            const toDate = new Date(args.filter.dateTo);
            matchingTodos = matchingTodos.filter(t => new Date(t.added) <= toDate);
          }

          // Text search
          if (args.filter.searchText) {
            const searchLower = args.filter.searchText.toLowerCase();
            matchingTodos = matchingTodos.filter(t =>
              t.task.toLowerCase().includes(searchLower)
            );
          }

          idsToRestore = matchingTodos.map(t => t.id);
        } else {
          throw new Error("Must provide id, ids array, or filter");
        }

        if (idsToRestore.length === 0) {
          return {
            content: [{ type: "text", text: "No completed todos matched the criteria" }],
          };
        }

        // Restore each todo
        const restored = [];
        for (const id of idsToRestore) {
          const result = await restoreTodoById(id);
          restored.push(result.restored);
        }

        const todos = await readTodos();

        if (restored.length === 1) {
          const todo = restored[0];
          const cat = todo.category && todo.subcategory
            ? `[${todo.category}/${todo.subcategory}] `
            : todo.category
              ? `[${todo.category}] `
              : "";
          return {
            content: [{
              type: "text",
              text: `Restored ${cat}"${todo.task}"\nActive items: ${todos.length}`
            }],
          };
        } else {
          let text = `Restored ${restored.length} todos:\n`;
          restored.forEach((t, i) => {
            const cat = t.category && t.subcategory
              ? `[${t.category}/${t.subcategory}] `
              : t.category
                ? `[${t.category}] `
                : "";
            text += `${i + 1}. ${cat}${t.task}\n`;
          });
          text += `\nActive items: ${todos.length}`;
          return {
            content: [{ type: "text", text }],
          };
        }
      }

      case "clear_todos": {
        const previousCount = await clearTodos({ filterByProject });
        const scope = filterByProject ? "project" : "all";
        return {
          content: [{
            type: "text",
            text: `Cleared ${scope} todos (${previousCount} items removed)`,
          }],
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
          content: [{
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
          }],
        };
      }

      case "set_color_profile": {
        await setColorProfile(args.profile);
        return {
          content: [{
            type: "text",
            text: `✓ Color profile set to: ${args.profile}`,
          }],
        };
      }

      case "set_scope": {
        await setScope(args.scope);
        const projectName = await detectProjectName();
        return {
          content: [{
            type: "text",
            text: `✓ Display scope set to: ${args.scope}\n${
              args.scope === 'global'
                ? 'Now showing todos from all projects'
                : `Now showing todos for: ${projectName || '(current project)'}`
            }\nNote: All todos are stored globally in ~/.tdl/ regardless of this setting.`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`,
      }],
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
