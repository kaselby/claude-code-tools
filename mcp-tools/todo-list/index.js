#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readTodos, writeTodos, formatTodoList } from "./lib.js";

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
          properties: {},
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
      const todos = await readTodos();
      todos.push({
        task: args.task,
        added: new Date().toISOString(),
      });
      await writeTodos(todos);
      return {
        content: [
          {
            type: "text",
            text: `Added to-do: "${args.task}"\nTotal items: ${todos.length}`,
          },
        ],
      };
    }

    case "remove_todo": {
      const todos = await readTodos();
      const index = args.index - 1;

      if (index < 0 || index >= todos.length) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Invalid index ${args.index}. Valid range: 1-${todos.length}`,
            },
          ],
          isError: true,
        };
      }

      const removed = todos.splice(index, 1)[0];
      await writeTodos(todos);
      return {
        content: [
          {
            type: "text",
            text: `Removed to-do: "${removed.task}"\nRemaining items: ${todos.length}`,
          },
        ],
      };
    }

    case "list_todos": {
      const todos = await readTodos();
      return {
        content: [
          {
            type: "text",
            text: formatTodoList(todos),
          },
        ],
      };
    }

    case "clear_todos": {
      const previousCount = (await readTodos()).length;
      await writeTodos([]);
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
