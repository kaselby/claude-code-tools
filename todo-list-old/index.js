#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { addTodo, removeTodo, listTodos, clearTodos } from "./lib.js";

const server = new Server(
  {
    name: "mcp-todo-list",
    version: "1.0.0",
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
        description: "Add a new item to the SHARED project to-do list. This is a user-facing todo list for tracking user-requested tasks and project goals, NOT for Claude's internal task tracking (use the TodoWrite tool for that). Only add items when the user explicitly requests tracking a task. Stay close to the user's wording. Users can also manage this list directly using /todo-add, /todo-list, and /todo-remove slash commands.",
        inputSchema: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "The task to add to the to-do list",
            },
            category: {
              type: "string",
              description: "Optional category to organize the task (e.g., 'backend', 'frontend', 'docs')",
            },
          },
          required: ["task"],
        },
      },
      {
        name: "remove_todo",
        description: "Remove an item from the SHARED project to-do list by index (1-based). This is for user-requested tasks only, NOT Claude's internal task tracking. Only remove items when the user explicitly requests it or confirms a task is complete. Users can also use /todo-remove.",
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
        name: "list_todos",
        description: "List all items in the SHARED project to-do list. This shows user-facing tasks and project goals, NOT Claude's internal task tracking. Use this to check what the user has requested to track. Users can also view the list using /todo-list.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional category to filter todos. Only shows todos matching this category.",
            },
          },
        },
      },
      {
        name: "clear_todos",
        description: "Clear all items from the SHARED project to-do list. This is for user-requested cleanup only. Only use when the user explicitly requests to clear the list. Users can also use /todo-clear.",
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

  switch (name) {
    case "add_todo": {
      try {
        // Validate input
        if (!args.task || typeof args.task !== "string" || !args.task.trim()) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Task description is required and cannot be empty",
              },
            ],
            isError: true,
          };
        }
        // Validate category if provided
        if (args.category !== undefined && (typeof args.category !== "string" || !args.category.trim())) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Category must be a non-empty string if provided",
              },
            ],
            isError: true,
          };
        }
        const category = args.category ? args.category.trim() : undefined;
        const result = await addTodo(args.task.trim(), category);
        const categoryText = result.category ? ` [${result.category}]` : "";
        return {
          content: [
            {
              type: "text",
              text: `Added to-do: "${result.task}"${categoryText}\nTotal items: ${result.total}`,
            },
          ],
        };
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
    }

    case "remove_todo": {
      try {
        // Validate input
        if (typeof args.index !== "number" || !Number.isInteger(args.index) || args.index < 1) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Index must be a positive integer",
              },
            ],
            isError: true,
          };
        }
        const result = await removeTodo(args.index);
        return {
          content: [
            {
              type: "text",
              text: `Removed to-do: "${result.removed.task}"\nRemaining items: ${result.remaining}`,
            },
          ],
        };
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
    }

    case "list_todos": {
      try {
        // Validate category if provided
        const category = args.category && typeof args.category === "string" ? args.category.trim() : undefined;
        const output = await listTodos(category);
        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
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
    }

    case "clear_todos": {
      try {
        const result = await clearTodos();
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
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
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
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
