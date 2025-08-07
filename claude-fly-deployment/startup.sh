#!/bin/bash
# FRANK'S STARTUP SCRIPT - Handle persistent Claude auth

echo "🔧 FRANK'S STARTUP SCRIPT"
echo "========================"

# Create persistent directories if they don't exist
mkdir -p /persistent/claude
mkdir -p /persistent/workspace

# CRITICAL: Handle .claude.json file (main config)
if [ ! -f "/persistent/.claude.json" ]; then
    echo "Creating persistent .claude.json with complete config..."
    cat > /persistent/.claude.json << 'EOF'
{
  "numStartups": 1,
  "autoUpdaterStatus": "enabled",
  "theme": "dark",
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "0.2.45",
  "shiftEnterKeyBindingInstalled": true,
  "lastReleaseNotesSeen": "0.2.45",
  "customApiKeyResponses": {
    "approved": [],
    "rejected": ["*"]
  },
  "projects": {
    "/app": {
      "allowedTools": ["*"],
      "history": [],
      "mcpContextUris": [],
      "mcpServers": {},
      "enabledMcpjsonServers": [],
      "disabledMcpjsonServers": [],
      "hasTrustDialogAccepted": true,
      "projectOnboardingSeenCount": 1,
      "hasClaudeMdExternalIncludesApproved": true,
      "hasClaudeMdExternalIncludesWarningShown": true,
      "hasDangerouslySkipPermissionsAccepted": true
    }
  },
  "hasDangerouslySkipPermissionsAccepted": true
}
EOF
    echo "✅ Created persistent .claude.json"
fi

# Remove any existing .claude.json and symlink to persistent one
rm -f /root/.claude.json
ln -s /persistent/.claude.json /root/.claude.json
echo "✅ Linked /root/.claude.json to persistent storage"

# Link Claude config directory to persistent storage
if [ ! -L "/root/.claude" ]; then
    # Remove any existing .claude directory
    rm -rf /root/.claude
    # Create symlink to persistent storage
    ln -s /persistent/claude /root/.claude
    echo "✅ Linked /root/.claude to persistent storage"
fi

# Link workspace to persistent storage
if [ ! -L "/workspace" ]; then
    # Remove any existing workspace
    rm -rf /workspace
    # Create symlink
    ln -s /persistent/workspace /workspace
    echo "✅ Linked /workspace to persistent storage"
fi

# Check if Claude is authenticated
if [ -f "/root/.claude/.credentials.json" ]; then
    echo "✅ Claude authentication found in persistent storage!"
    
    # Create settings.json if it doesn't exist to skip theme prompt
    if [ ! -f "/root/.claude/settings.json" ]; then
        echo "Creating Claude settings to skip theme prompt..."
        cat > /root/.claude/settings.json << 'EOF'
{
  "claude_enabled": true,
  "output_format": "markdown",
  "ui_style": "dark",
  "autoApprove": {
    "bash": false,
    "write": false,
    "str_replace_editor": false
  },
  "dangerouslySkipApprovals": false
}
EOF
        echo "✅ Claude settings created"
    fi
    
    # CRITICAL: Unset ANTHROPIC_API_KEY to prevent Claude Code CLI from prompting about it
    # Claude Code CLI uses OAuth, not API keys!
    unset ANTHROPIC_API_KEY
    
    # Auto-start tmux session with Claude if credentials exist
    # Use IS_SANDBOX=1 to bypass root check for --dangerously-skip-permissions
    echo "Starting Claude in tmux session (OAuth mode, skip permissions)..."
    tmux -f /etc/tmux.conf new-session -d -s claude-manual -c /app "cd /app && IS_SANDBOX=1 claude --dangerously-skip-permissions"
    
    # Wait a bit for Claude to start
    sleep 5
    
    # Auto-accept dangerous permissions if prompted
    if tmux -f /etc/tmux.conf capture-pane -t claude-manual -p | grep -q "Yes, I accept"; then
        echo "Auto-accepting dangerous permissions..."
        tmux -f /etc/tmux.conf send-keys -t claude-manual '2' Enter
        sleep 3
    fi
    
    # Check if Claude started properly
    if tmux -f /etc/tmux.conf list-sessions 2>/dev/null | grep -q claude-manual; then
        echo "✅ Claude tmux session started and ready!"
    else
        echo "❌ Failed to start Claude tmux session"
    fi
else
    echo "⚠️  Claude not authenticated yet. You'll need to set up claude-manual session."
    # Create empty tmux session for manual setup (in /app directory)
    tmux -f /etc/tmux.conf new-session -d -s claude-manual -c /app
fi

# Run the auth setup script
./setup-claude-auth.sh

# Start the server
echo "Starting Uncle Frank's Claude Executor..."
node server.js