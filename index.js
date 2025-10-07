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
  removeTodo,
  completeTodo,
  clearTodos,
  filterTodos,
  getCategories,
  getStats,
  updateTodo,
  bulkUpdate,
  bulkDelete,
  queryHistory,
  restoreTodo,
} from "./lib.js";

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
          "Add a new item to the project to-do list. Stay close to the user's wording - you can clean up loose shorthand but don't add extra details or significantly change what they said.",
        inputSchema: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "The task to add (use 'category::task' format to add a category)",
            },
          },
          required: ["task"],
        },
      },
      {
        name: "get_todos",
        description:
          "Get raw todo data for Claude to inspect silently. Returns JSON array of todos with optional filtering. Use this when you need to check if tasks exist or query the list without displaying to the user.",
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
          "Display a formatted, pretty-printed todo list to the user. Use this after modifications to show the updated list, or when the user asks to see their todos.",
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
          "Update a single todo's text and/or category by its index number.",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The 1-based index of the todo to update",
            },
            task: {
              type: "string",
              description: "New task text (optional)",
            },
            category: {
              type: ["string", "null"],
              description: "New category tag, or null to remove category (optional)",
            },
          },
          required: ["index"],
        },
      },
      {
        name: "bulk_update",
        description:
          "Update multiple todos matching filter criteria. Useful for moving todos between categories or batch editing.",
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "object",
              description: "Filter criteria (category, untagged, dateFrom, dateTo, searchText)",
              properties: {
                category: { type: "string" },
                untagged: { type: "boolean" },
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
              },
            },
          },
          required: ["updates"],
        },
      },
      {
        name: "bulk_delete",
        description:
          "Delete multiple todos matching filter criteria. Useful for cleaning up completed todos or removing entire categories.",
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "object",
              description: "Filter criteria (category, untagged, dateFrom, dateTo, searchText)",
              properties: {
                category: { type: "string" },
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
        name: "remove_todo",
        description:
          "Remove a single todo by index (1-based). Permanently deletes without saving to history. For bulk operations, use bulk_delete instead.",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The 1-based index of the task to remove",
            },
          },
          required: ["index"],
        },
      },
      {
        name: "complete_todo",
        description:
          "Mark a todo as complete by index (1-based). Moves it to history where it can be viewed today and restored if needed. History clears automatically at midnight.",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The 1-based index of the task to complete",
            },
          },
          required: ["index"],
        },
      },
      {
        name: "query_history",
        description:
          "Query completed todos from today. History automatically clears at midnight each day.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "restore_todo",
        description:
          "Restore a completed todo from history back to the active list. Use the index from query_history results.",
        inputSchema: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "The 1-based index from the history list",
            },
          },
          required: ["index"],
        },
      },
      {
        name: "clear_todos",
        description: "Clear all todos from the project list. Use with caution - this cannot be undone.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "add_todo": {
        const { todos, added } = await addTodo(args.task);
        const displayText = added.category
          ? `Added to-do [${added.category}]: "${added.task}"\nTotal items: ${todos.length}`
          : `Added to-do: "${added.task}"\nTotal items: ${todos.length}`;

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
        // Include original indices when filtering so displayed numbers match actual indices
        const filteredTodos = await filterTodos({ ...args, includeIndices: true });
        const history = await queryHistory();

        return {
          content: [
            {
              type: "text",
              text: await formatTodoList(
                filteredTodos,
                args?.category || (args?.untagged ? "untagged" : null),
                history
              ),
            },
          ],
        };
      }

      case "get_metadata": {
        const categories = await getCategories();
        const stats = await getStats();

        const metadata = {
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
        const { todos, updated } = await updateTodo(args.index, {
          task: args.task,
          category: args.category,
        });

        const displayText = updated.category
          ? `Updated to-do #${args.index}: [${updated.category}] "${updated.task}"`
          : `Updated to-do #${args.index}: "${updated.task}"`;

        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "bulk_update": {
        const { todos, updated, count } = await bulkUpdate(
          args.filter || {},
          args.updates
        );

        return {
          content: [
            {
              type: "text",
              text: `Updated ${count} todo(s)\n\nUpdated items:\n${updated
                .map(
                  (t, i) =>
                    `${i + 1}. ${t.category ? `[${t.category}] ` : ""}${t.task}`
                )
                .join("\n")}`,
            },
          ],
        };
      }

      case "bulk_delete": {
        const { todos, deleted, count } = await bulkDelete(args.filter || {});

        return {
          content: [
            {
              type: "text",
              text: `Deleted ${count} todo(s)\n\nDeleted items:\n${deleted
                .map(
                  (t, i) =>
                    `${i + 1}. ${t.category ? `[${t.category}] ` : ""}${t.task}`
                )
                .join("\n")}\n\nRemaining todos: ${todos.length}`,
            },
          ],
        };
      }

      case "remove_todo": {
        const { todos, removed} = await removeTodo(args.index);
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
        const { todos, completed } = await completeTodo(args.index);
        const displayText = completed.category
          ? `✓ Completed [${completed.category}]: "${completed.task}"\nRemaining items: ${todos.length}`
          : `✓ Completed: "${completed.task}"\nRemaining items: ${todos.length}`;
        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "query_history": {
        const history = await queryHistory();
        if (history.length === 0) {
          return {
            content: [
              { type: "text", text: "No completed todos today." },
            ],
          };
        }

        const historyText = history
          .map((t, i) => {
            const cat = t.category ? `[${t.category}${t.subcategory ? `/${t.subcategory}` : ''}] ` : '';
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
        const { todos, restored } = await restoreTodo(args.index);
        const displayText = restored.category
          ? `Restored [${restored.category}]: "${restored.task}"\nActive items: ${todos.length}`
          : `Restored: "${restored.task}"\nActive items: ${todos.length}`;
        return {
          content: [{ type: "text", text: displayText }],
        };
      }

      case "clear_todos": {
        const previousCount = await clearTodos();
        return {
          content: [
            {
              type: "text",
              text: `Cleared all to-dos (${previousCount} items removed)`,
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
