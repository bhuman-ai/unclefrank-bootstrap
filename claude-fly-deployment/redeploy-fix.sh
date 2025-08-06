#!/bin/bash
# FRANK'S FIX DEPLOYMENT SCRIPT
# Redeploys the Claude executor with the PTY fix

echo "🔧 FRANK'S FIXING THE BROKEN CLAUDE EXECUTOR"
echo "============================================"

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not installed. Install it first:"
    echo "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

echo "📦 Deploying fixed Claude executor to fly.io..."

# Deploy with the fixed server
fly deploy --app uncle-frank-claude --no-cache

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🔍 Checking deployment status..."
    fly status --app uncle-frank-claude
    
    echo ""
    echo "📊 Checking logs for errors..."
    fly logs --app uncle-frank-claude | tail -20
    
    echo ""
    echo "🧪 Testing the fixed endpoint..."
    curl -s https://uncle-frank-claude.fly.dev/health | jq '.'
    
    echo ""
    echo "✅ FRANK SAYS: The executor should be fixed now!"
    echo "Go back to the UI and retry the stuck task."
else
    echo "❌ Deployment failed! Check the errors above."
    exit 1
fi