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
    echo "Starting Claude in tmux session..."
    # Start tmux session first
    tmux -f /etc/tmux.conf new-session -d -s claude-manual -c /app
    
    # Then send the claude command to it
    sleep 2
    tmux -f /etc/tmux.conf send-keys -t claude-manual "claude --dangerously-skip-permissions" Enter
    
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
    echo "⚠️  Claude not authenticated yet. Starting Claude for manual setup..."
    # Create tmux session and start Claude for manual auth
    tmux -f /etc/tmux.conf new-session -d -s claude-manual -c /app
    sleep 2
    tmux -f /etc/tmux.conf send-keys -t claude-manual "claude" Enter
    echo "Claude started in tmux session for manual authentication"
fi

# Run the auth setup script
./setup-claude-auth.sh

# Start the tmux injector in background
echo "Starting tmux injector..."
chmod +x tmux-injector.sh
nohup ./tmux-injector.sh > /app/tmux-injector.log 2>&1 &
INJECTOR_PID=$!
echo "Tmux injector started with PID: $INJECTOR_PID"

# Start the monitor server
echo "Starting monitor server..."
nohup node monitor-server.js > /app/monitor.log 2>&1 &
MONITOR_PID=$!
echo "Monitor server started with PID: $MONITOR_PID on port 8081"

# Start the INTELLIGENT AUTO-IMPROVE SYSTEM
echo "🧠 Starting INTELLIGENT AUTO-IMPROVE..."
nohup node auto-improve-intelligent.js > /app/auto-improve.log 2>&1 &
AUTO_PID=$!
echo "✅ Intelligent auto-improve started with PID: $AUTO_PID"
echo "Will:"
echo "  1. Read 'docs to work towards' files"
echo "  2. Analyze current implementation"
echo "  3. Find gaps automatically"
echo "  4. Generate tasks with checkpoints"
echo "  5. Execute via Claude queue system"
echo "  6. Push to GitHub → Vercel"

# Copy PM2 ecosystem config
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js /app/
fi

# Start the server with PM2 for better process management
echo "Starting Uncle Frank's Claude Executor with PM2..."
if command -v pm2 &> /dev/null; then
    # Use PM2 if available
    pm2 start ecosystem.config.js --no-daemon
else
    # Fallback to direct node execution
    echo "PM2 not found, starting with node directly..."
    node server-queue.js
fi