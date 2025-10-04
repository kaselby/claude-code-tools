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

# Configure auto-approval for todo-list MCP tools
echo "Checking tool approval configuration..."
CONFIG_FILE="$HOME/.claude/config.json"

if [ -f "$CONFIG_FILE" ]; then
  # Check if jq is available
  if ! command -v jq &> /dev/null; then
    echo "Warning: jq is not installed. Skipping auto-approval configuration."
    echo "You can manually add 'mcp__todo-list__*' to toolApprovalConfig.autoApprove in $CONFIG_FILE"
  else
    # Check if auto-approval is already configured
    AUTO_APPROVE_SET=$(jq -e '.toolApprovalConfig.autoApprove // [] | any(. == "mcp__todo-list__*")' "$CONFIG_FILE" 2>/dev/null || echo "false")

    if [ "$AUTO_APPROVE_SET" = "false" ]; then
      echo ""
      read -p "Do you want to auto-approve todo-list MCP tools (recommended)? [Y/n] " -n 1 -r
      echo ""

      if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        echo "Configuring auto-approval for todo-list tools..."

        # Create backup
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

        # Add auto-approval configuration
        jq '.toolApprovalConfig.autoApprove |= (. // []) + ["mcp__todo-list__*"] | .toolApprovalConfig.autoApprove |= unique' "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
        mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

        echo "✓ Auto-approval configured for todo-list tools"
      else
        echo "Skipping auto-approval configuration."
        echo "You can manually add 'mcp__todo-list__*' to toolApprovalConfig.autoApprove in $CONFIG_FILE"
      fi
    else
      echo "✓ Auto-approval already configured for todo-list tools"
    fi
  fi
else
  echo "Note: Claude Code config file not found at $CONFIG_FILE"
  echo "Auto-approval will need to be configured manually after first run."
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "The MCP To-Do List tool has been added to your Claude Code configuration."
echo "Slash commands installed: /todo-add, /todo-list, /todo-remove, /todo-clear"
echo "Restart Claude Code to start using it."
