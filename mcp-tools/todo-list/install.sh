#!/bin/bash

set -e

echo "Installing MCP To-Do List tool..."

# Get the absolute path to this script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies
echo "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# Path to Claude Code config
CONFIG_FILE="$HOME/.claude/config.json"

# Create config directory if it doesn't exist
mkdir -p "$HOME/.claude"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Creating new config file..."
    echo '{"mcpServers":{}}' > "$CONFIG_FILE"
fi

# Read existing config
CONFIG_CONTENT=$(cat "$CONFIG_FILE")

# Check if mcpServers exists
if ! echo "$CONFIG_CONTENT" | grep -q '"mcpServers"'; then
    echo "Adding mcpServers section to config..."
    CONFIG_CONTENT=$(echo "$CONFIG_CONTENT" | jq '. + {mcpServers: {}}')
fi

# Add todo-list server configuration
echo "Adding todo-list to MCP servers..."
CONFIG_CONTENT=$(echo "$CONFIG_CONTENT" | jq \
    --arg path "$SCRIPT_DIR/index.js" \
    '.mcpServers["todo-list"] = {command: "node", args: [$path]}')

# Write updated config
echo "$CONFIG_CONTENT" | jq '.' > "$CONFIG_FILE"

echo ""
echo "✓ Installation complete!"
echo ""
echo "The MCP To-Do List tool has been added to your Claude Code configuration."
echo "Restart Claude Code to start using it."
