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
    
    # NO LONGER STARTING TMUX SESSION - Using direct execution
    echo "✅ Claude authenticated! Using --print flag for direct execution"
    echo "📦 No tmux session needed - commands execute directly"
else
    echo "⚠️  Claude not authenticated yet. Starting Claude for manual setup..."
    # Create tmux session and start Claude for manual auth
    tmux -f /etc/tmux.conf new-session -d -s claude-manual -c /app
    sleep 2
    tmux -f /etc/tmux.conf send-keys -t claude-manual "claude --dangerously-skip-permissions" C-m
    echo "Claude started in tmux session for manual authentication"
fi

# Run the auth setup script
./setup-claude-auth.sh

# NO LONGER NEEDED - Using direct claude --print execution
# echo "Starting tmux injector..."
# chmod +x tmux-injector.sh
# nohup ./tmux-injector.sh > /app/tmux-injector.log 2>&1 &
# INJECTOR_PID=$!
# echo "Tmux injector NO LONGER NEEDED - using direct execution"

# Start the monitor server
echo "Starting monitor server..."
nohup node monitor-server.js > /app/monitor.log 2>&1 &
MONITOR_PID=$!
echo "Monitor server started with PID: $MONITOR_PID on port 8081"

# Start the TASK-CREATING AUTO-IMPROVE SYSTEM
echo "🧠 Starting UNCLE FRANK AUTO-IMPROVE (Task Creator Mode)..."
if [ -f "auto-improve-task-creator.js" ]; then
    nohup node auto-improve-task-creator.js > /app/auto-improve.log 2>&1 &
    AUTO_PID=$!
    echo "✅ Auto-improve task creator started with PID: $AUTO_PID"
    echo "✨ Using Uncle Frank task management system!"
    echo "Will:"
    echo "  1. Read docs-future/ specifications"
    echo "  2. Compare with docs-current/ and actual code"
    echo "  3. Find gaps automatically"
    echo "  4. CREATE TASKS in Uncle Frank system"
    echo "  5. Tasks execute through proper flow"
    echo "  6. Push to GitHub → Vercel"
else
    echo "⚠️  auto-improve-task-creator.js not found, skipping auto-improve"
fi

# Copy PM2 ecosystem config
if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js /app/
fi

# Start the FIXED server with direct execution
echo "Starting Uncle Frank's FIXED Claude Executor..."
if [ -f "server-direct.js" ]; then
    echo "✅ Using server-direct.js with claude --print execution"
    node server-direct.js
else
    echo "⚠️  server-direct.js not found, falling back to server-queue.js"
    node server-queue.js
fi