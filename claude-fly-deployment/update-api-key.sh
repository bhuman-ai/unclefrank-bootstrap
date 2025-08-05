#!/bin/bash

# Update Anthropic API key for Claude Executor

echo "🔑 Setting Anthropic API key for Claude Executor..."

cd /Users/don/UncleFrank/unclefrank-bootstrap/claude-fly-deployment

# Install fly CLI if not present
if ! command -v fly &> /dev/null; then
    echo "📦 Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Set the API key
echo "Setting API key as secret..."
fly secrets set ANTHROPIC_API_KEY="$1" -a uncle-frank-claude

echo "✅ API key updated. The app will restart automatically."
echo ""
echo "Test it with:"
echo "curl https://uncle-frank-claude.fly.dev/health"