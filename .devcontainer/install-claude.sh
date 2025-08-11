#!/bin/bash

echo "📦 Installing Claude CLI for Codespaces..."

# Method 1: Try npm global install
echo "Trying npm install..."
npm install -g @anthropic-ai/claude-cli 2>/dev/null

# Method 2: Install locally and create alias
if ! command -v claude &> /dev/null; then
    echo "Installing Claude locally..."
    npm install @anthropic-ai/claude-cli
    
    # Create a wrapper script
    cat > /usr/local/bin/claude << 'EOF'
#!/bin/bash
node /workspaces/unclefrank-bootstrap/node_modules/@anthropic-ai/claude-cli/bin/claude "$@"
EOF
    chmod +x /usr/local/bin/claude
fi

# Method 3: Direct download if available
if ! command -v claude &> /dev/null; then
    echo "Trying direct download..."
    curl -fsSL https://claude.ai/cli/install.sh | sh 2>/dev/null || true
fi

# Test if it worked
if command -v claude &> /dev/null; then
    echo "✅ Claude CLI installed successfully!"
    claude --version
else
    echo "⚠️  Claude CLI not found. You'll need to:"
    echo "1. Install Claude Desktop on your local machine"
    echo "2. Use the API directly with your key"
    echo ""
    echo "For now, you can use the web UI or API endpoints."
fi