#!/bin/bash

# FRANK'S FLY.IO DEPLOYMENT SCRIPT

echo "🚀 Deploying Claude Executor to Fly.io"
echo "====================================="

# Check if fly is installed
if ! command -v fly &> /dev/null; then
    echo "📦 Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Please log in to Fly.io:"
    fly auth login
fi

# Create app
echo "📱 Creating Fly app..."
fly apps create uncle-frank-claude --org personal

# Create volume for persistent storage
echo "💾 Creating persistent volume..."
fly volumes create workspace_data --size 10 --region ord

# Set secrets
echo "🔑 Setting secrets..."
if [ -z "$ANTHROPIC_API_KEY" ]; then
    read -p "Enter your Anthropic API key: " ANTHROPIC_API_KEY
fi
fly secrets set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY

# Deploy
echo "🚀 Deploying..."
fly deploy

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
fly status
echo ""
echo "📍 Your Claude Executor is running at:"
fly info | grep "Hostname"
echo ""
echo "🧪 Test with:"
echo "curl https://uncle-frank-claude.fly.dev/health"
echo ""
echo "📋 Create a session:"
echo 'curl -X POST https://uncle-frank-claude.fly.dev/api/sessions \
  -H "Content-Type: application/json" \
  -d "{}"'