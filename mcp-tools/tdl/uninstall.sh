#!/bin/bash

set -e

echo "Uninstalling MCP TDL tool..."

# Remove slash commands
echo "Removing slash commands..."
rm -f "$HOME/.claude/commands/tdl-add.md"
rm -f "$HOME/.claude/commands/tdl-list.md"
rm -f "$HOME/.claude/commands/tdl-remove.md"
rm -f "$HOME/.claude/commands/tdl-clear.md"
echo "  ✓ Removed slash commands"

# Remove MCP server using Claude CLI (both user and project scope)
echo "Removing MCP server..."
REMOVED=false

if claude mcp remove --scope user tdl 2>/dev/null; then
  echo "  ✓ Removed MCP server from user config"
  REMOVED=true
fi

if claude mcp remove tdl 2>/dev/null; then
  echo "  ✓ Removed MCP server from project config"
  REMOVED=true
fi

if [ "$REMOVED" = false ]; then
  echo "  ℹ MCP server was not installed"
fi

echo ""
echo "✓ Uninstallation complete!"
echo ""
echo "The MCP TDL tool has been removed from your Claude Code configuration."
echo "Restart Claude Code to complete the removal."
