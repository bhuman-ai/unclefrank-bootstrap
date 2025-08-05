#!/bin/bash
# Setup Claude Code CLI authentication from environment variable

if [ ! -z "$CLAUDE_CONFIG" ]; then
    echo "Setting up Claude Code CLI authentication..."
    mkdir -p ~/.config/claude
    echo "$CLAUDE_CONFIG" > ~/.config/claude/config.json
    chmod 600 ~/.config/claude/config.json
    echo "✅ Claude Code CLI configured from secret"
    
    # Verify authentication
    if claude auth status 2>&1 | grep -q "Authenticated"; then
        echo "✅ Claude Code CLI authenticated successfully"
    else
        echo "❌ Claude Code CLI authentication failed"
        exit 1
    fi
else
    echo "⚠️  No CLAUDE_CONFIG secret found"
    echo "Checking if Claude is already authenticated..."
    if claude auth status 2>&1 | grep -q "Authenticated"; then
        echo "✅ Claude Code CLI already authenticated"
    else
        echo "❌ Claude Code CLI not authenticated"
        echo "Please set CLAUDE_CONFIG secret or use SSH tunnel method"
    fi
fi