#!/bin/bash

# Setup Claude Code on Fly.io with remote authentication

echo "🚀 Setting up Claude Code Authentication"
echo "======================================="
echo ""
echo "Since we can't open a browser on the server, we'll use a workaround:"
echo ""
echo "Option 1: Port Forwarding Method"
echo "---------------------------------"
echo "1. Exit the current SSH session (Ctrl+] then quit)"
echo "2. Create an SSH tunnel to forward the auth callback:"
echo ""
echo "   fly proxy 8080:8080 -a uncle-frank-claude"
echo ""
echo "3. In another terminal, SSH in and run claude:"
echo ""
echo "   fly ssh console -a uncle-frank-claude"
echo "   claude"
echo ""
echo "4. When it tries to open browser, copy the URL and open locally"
echo ""
echo "Option 2: Headless Authentication"
echo "---------------------------------"
echo "1. In the SSH session, try:"
echo ""
echo "   export CLAUDE_HEADLESS=true"
echo "   claude login --no-browser"
echo ""
echo "2. It should print a URL - copy and open it locally"
echo ""
echo "Option 3: Pre-authenticate Locally"
echo "-----------------------------------"
echo "1. Install Claude Code locally first:"
echo "   npm install -g @anthropic-ai/claude-code"
echo ""
echo "2. Authenticate locally:"
echo "   claude login"
echo ""
echo "3. Find your auth token (usually in ~/.claude/config.json)"
echo ""
echo "4. Copy the config to the server via SSH"
echo ""
echo "Press Enter to see the authentication flow..."
read

# Try headless mode
cat << 'EOF'
In your SSH session, run these commands:

# Set headless mode
export CLAUDE_HEADLESS=true
export BROWSER=none

# Try login with no-browser flag
claude login --no-browser

# If that doesn't work, try:
claude --no-browser

# Or check if already authenticated:
claude doctor
claude --version

# Test with a simple command:
claude chat --message "Hello, are you working?"
EOF