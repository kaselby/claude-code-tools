#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { formatTodoList, addTodo, removeTodo, clearTodos } from "./lib.js";

const server = new Server(
  {
    name: "mcp-todo-list",
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
              description: "The task to add to the to-do list",
            },
          },
          required: ["task"],
        },
      },
      {
        name: "remove_todo",
        description:
          "Remove an item from the project to-do list by index (1-based)",
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
        description: "List all items in the project to-do list",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional: filter todos by category tag",
            },
          },
        },
      },
      {
        name: "clear_todos",
        description: "Clear all items from the project to-do list",
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
      const { todos, added } = await addTodo(args.task);

      const displayText = added.category
        ? `Added to-do [${added.category}]: "${added.task}"\nTotal items: ${todos.length}`
        : `Added to-do: "${added.task}"\nTotal items: ${todos.length}`;

      return {
        content: [
          {
            type: "text",
            text: displayText,
          },
        ],
      };
    }

    case "remove_todo": {
      try {
        const { todos, removed } = await removeTodo(args.index);
        return {
          content: [
            {
              type: "text",
              text: `Removed to-do: "${removed.task}"\nRemaining items: ${todos.length}`,
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
      const { readTodos } = await import("./lib.js");
      const todos = await readTodos();
      const category = args?.category;
      const filteredTodos = category
        ? todos.filter((t) => t.category === category)
        : todos;
      return {
        content: [
          {
            type: "text",
            text: formatTodoList(filteredTodos, category),
          },
        ],
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
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
