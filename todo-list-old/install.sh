#!/bin/bash

set -e

echo "Installing MCP To-Do List tool..."

# Get the absolute path to this script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies
echo "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# Add or update MCP server using Claude CLI
echo "Adding todo-list to MCP servers..."
if claude mcp add --scope user todo-list node "$SCRIPT_DIR/index.js" 2>&1 | grep -q "already exists"; then
  echo "MCP server already exists, updating configuration..."
  claude mcp remove --scope user todo-list 2>/dev/null || true
  claude mcp add --scope user todo-list node "$SCRIPT_DIR/index.js"
fi

# Install slash commands
echo "Installing slash commands..."
CLAUDE_DIR="$HOME/.claude/commands"
mkdir -p "$CLAUDE_DIR"

# Copy slash command definitions
cp "$SCRIPT_DIR/commands/todo-add.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/todo-list.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/todo-remove.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/todo-clear.md" "$CLAUDE_DIR/"

echo ""
echo "✓ Installation complete!"
echo ""
echo "The MCP To-Do List tool has been added to your Claude Code configuration."
echo "Slash commands installed: /todo-add, /todo-list, /todo-remove, /todo-clear"
echo "Restart Claude Code to start using it."
