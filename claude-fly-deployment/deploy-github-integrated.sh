#!/bin/bash

# Deploy GitHub-Integrated Claude Executor

echo "🚀 Deploying GitHub-Integrated Claude Executor"
echo "============================================"

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN not set!"
    echo "   You need a GitHub Personal Access Token with repo permissions"
    echo "   Create one at: https://github.com/settings/tokens"
    echo ""
    read -p "Enter your GitHub token: " GITHUB_TOKEN
fi

# Update Dockerfile
echo "📦 Updating to GitHub-integrated version..."
cp Dockerfile.github Dockerfile

# Copy the new server
cp server-github-integrated.js server.js

# Set secrets on Fly.io
echo "🔑 Setting GitHub secrets..."
fly secrets set GITHUB_TOKEN="$GITHUB_TOKEN" -a uncle-frank-claude
fly secrets set GITHUB_REPO="bhuman-ai/unclefrank-bootstrap" -a uncle-frank-claude
fly secrets set GITHUB_USER="bhuman-ai" -a uncle-frank-claude
fly secrets set GITHUB_EMAIL="frank@unclefrank.ai" -a uncle-frank-claude

# Deploy
echo "🚀 Deploying to Fly.io..."
fly deploy --strategy rolling

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
fly status -a uncle-frank-claude
echo ""
echo "📋 Test the GitHub integration:"
echo "   1. Create a session: curl -X POST https://uncle-frank-claude.fly.dev/api/sessions"
echo "   2. It will clone the repo and create a branch"
echo "   3. Execute tasks that create real files"
echo "   4. Commit and push changes back to GitHub"