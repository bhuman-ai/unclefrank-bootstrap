#!/bin/bash

echo "🚀 Deploying API-based Claude Executor to Fly.io"
echo "=============================================="
echo ""

# Check if API key is set in Fly.io
echo "First, ensure the Anthropic API key is set:"
echo "fly secrets set ANTHROPIC_API_KEY=your-api-key -a uncle-frank-claude"
echo ""

# Update Dockerfile to use API version
echo "Updating deployment to use API-based server..."
sed -i.bak 's/server-github-integrated.js/server-api-based.js/g' Dockerfile

# Deploy
echo "Deploying to Fly.io..."
fly deploy -a uncle-frank-claude

# Restore original Dockerfile
mv Dockerfile.bak Dockerfile

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Test the deployment:"
echo "node diagnose-claude-integration.js"