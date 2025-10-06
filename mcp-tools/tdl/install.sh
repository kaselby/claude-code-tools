#!/bin/bash

set -e

echo "Installing MCP TDL tool..."

# Get the absolute path to this script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies
echo "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# Add or update MCP server using Claude CLI
echo "Adding tdl to MCP servers..."
if claude mcp add --scope user tdl node "$SCRIPT_DIR/index.js" 2>&1 | grep -q "already exists"; then
  echo "MCP server already exists, updating configuration..."
  claude mcp remove --scope user tdl 2>/dev/null || true
  claude mcp add --scope user tdl node "$SCRIPT_DIR/index.js"
fi

# Install slash commands
echo "Installing slash commands..."
CLAUDE_DIR="$HOME/.claude/commands"
mkdir -p "$CLAUDE_DIR"

# Copy slash command definitions
cp "$SCRIPT_DIR/commands/tdl.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/tdl-add.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/tdl-check.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/tdl-remove.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/tdl-history.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/tdl-restore.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/tdl-clear.md" "$CLAUDE_DIR/"

# Configure auto-approval for tdl MCP tools
echo "Checking tool approval configuration..."
CONFIG_FILE="$HOME/.claude/config.json"

if [ -f "$CONFIG_FILE" ]; then
  # Check if jq is available
  if ! command -v jq &> /dev/null; then
    echo "Warning: jq is not installed. Skipping auto-approval configuration."
    echo "You can manually add 'mcp__tdl__*' to toolApprovalConfig.autoApprove in $CONFIG_FILE"
  else
    # Check if auto-approval is already configured
    AUTO_APPROVE_SET=$(jq -e '.toolApprovalConfig.autoApprove // [] | any(. == "mcp__tdl__*")' "$CONFIG_FILE" 2>/dev/null || echo "false")

    if [ "$AUTO_APPROVE_SET" = "false" ]; then
      echo ""
      read -p "Do you want to auto-approve tdl MCP tools (recommended)? [Y/n] " -n 1 -r
      echo ""

      if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        echo "Configuring auto-approval for tdl tools..."

        # Create backup
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

        # Add auto-approval configuration
        jq '.toolApprovalConfig.autoApprove |= (. // []) + ["mcp__tdl__*"] | .toolApprovalConfig.autoApprove |= unique' "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
        mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

        echo "✓ Auto-approval configured for tdl tools"
      else
        echo "Skipping auto-approval configuration."
        echo "You can manually add 'mcp__tdl__*' to toolApprovalConfig.autoApprove in $CONFIG_FILE"
      fi
    else
      echo "✓ Auto-approval already configured for tdl tools"
    fi
  fi
else
  echo "Note: Claude Code config file not found at $CONFIG_FILE"
  echo "Auto-approval will need to be configured manually after first run."
fi

# Offer to add proactive usage instructions to global CLAUDE.md
echo ""
echo "Checking for proactive usage instructions..."
GLOBAL_CLAUDE_MD="$HOME/.claude/CLAUDE.md"

# Extract version from the new instructions
NEW_VERSION=$(grep -o 'TDL_PROACTIVE_USAGE_START:v[0-9.]*' "$SCRIPT_DIR/CLAUDE_INSTRUCTIONS.md" | cut -d: -f2)

# Check if the instructions are already present
if [ -f "$GLOBAL_CLAUDE_MD" ] && grep -q "TDL_PROACTIVE_USAGE_START" "$GLOBAL_CLAUDE_MD"; then
  # Get the installed version
  INSTALLED_VERSION=$(grep -o 'TDL_PROACTIVE_USAGE_START:v[0-9.]*' "$GLOBAL_CLAUDE_MD" | cut -d: -f2)

  if [ "$INSTALLED_VERSION" = "$NEW_VERSION" ]; then
    echo "✓ Proactive usage instructions already up to date ($INSTALLED_VERSION) in $GLOBAL_CLAUDE_MD"
  else
    echo ""
    echo "Found TDL proactive usage instructions version $INSTALLED_VERSION in $GLOBAL_CLAUDE_MD"
    echo "New version $NEW_VERSION is available with updates."
    echo ""
    read -p "Update to version $NEW_VERSION? [Y/n] " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
      echo "Updating proactive usage instructions..."

      # Create backup
      cp "$GLOBAL_CLAUDE_MD" "$GLOBAL_CLAUDE_MD.backup"

      # Remove old section (everything between START and END markers)
      sed -i.tmp '/<!-- TDL_PROACTIVE_USAGE_START/,/<!-- TDL_PROACTIVE_USAGE_END/d' "$GLOBAL_CLAUDE_MD"
      rm -f "$GLOBAL_CLAUDE_MD.tmp"

      # Add a blank line if file is not empty and doesn't end with newline
      if [ -s "$GLOBAL_CLAUDE_MD" ]; then
        if [ -n "$(tail -c 1 "$GLOBAL_CLAUDE_MD")" ]; then
          echo "" >> "$GLOBAL_CLAUDE_MD"
        fi
        echo "" >> "$GLOBAL_CLAUDE_MD"
      fi

      # Add new section
      sed -n '/<!-- TDL_PROACTIVE_USAGE_START/,/<!-- TDL_PROACTIVE_USAGE_END/p' "$SCRIPT_DIR/CLAUDE_INSTRUCTIONS.md" >> "$GLOBAL_CLAUDE_MD"

      echo "✓ Proactive usage instructions updated to $NEW_VERSION"
      echo "  Backup saved to $GLOBAL_CLAUDE_MD.backup"
    else
      echo "Skipping update. Current version: $INSTALLED_VERSION"
    fi
  fi
else
  echo ""
  echo "TDL can optionally add usage instructions to your global CLAUDE.md file."
  echo "This teaches Claude when to proactively use TDL tools (display after modifications,"
  echo "add tasks for long-term work, ask about checking off completed tasks)."
  echo ""
  read -p "Add proactive usage instructions to $GLOBAL_CLAUDE_MD? [Y/n] " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo "Adding proactive usage instructions..."

    # Create .claude directory if it doesn't exist
    mkdir -p "$HOME/.claude"

    # Create CLAUDE.md if it doesn't exist
    if [ ! -f "$GLOBAL_CLAUDE_MD" ]; then
      touch "$GLOBAL_CLAUDE_MD"
    fi

    # Add a blank line if file is not empty and doesn't end with newline
    if [ -s "$GLOBAL_CLAUDE_MD" ]; then
      # Check if file ends with newline
      if [ -n "$(tail -c 1 "$GLOBAL_CLAUDE_MD")" ]; then
        echo "" >> "$GLOBAL_CLAUDE_MD"
      fi
      echo "" >> "$GLOBAL_CLAUDE_MD"
    fi

    # Extract the section between markers from CLAUDE_INSTRUCTIONS.md
    sed -n '/<!-- TDL_PROACTIVE_USAGE_START/,/<!-- TDL_PROACTIVE_USAGE_END/p' "$SCRIPT_DIR/CLAUDE_INSTRUCTIONS.md" >> "$GLOBAL_CLAUDE_MD"

    echo "✓ Proactive usage instructions added to $GLOBAL_CLAUDE_MD ($NEW_VERSION)"
  else
    echo "Skipping proactive usage instructions."
    echo "You can manually add the content from $SCRIPT_DIR/CLAUDE_INSTRUCTIONS.md"
  fi
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "The MCP TDL tool has been added to your Claude Code configuration."
echo "Slash commands installed:"
echo "  /tdl, /tdl-add, /tdl-check, /tdl-remove"
echo "  /tdl-history, /tdl-restore, /tdl-clear"
echo "Restart Claude Code to start using it."
