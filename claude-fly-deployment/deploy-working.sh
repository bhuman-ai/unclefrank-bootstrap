#!/bin/bash
# FRANK'S WORKING DEPLOYMENT - SIMPLER APPROACH

echo "🚀 Deploying WORKING Claude executor..."
echo "======================================="

cd /Users/don/UncleFrank/unclefrank-bootstrap/claude-fly-deployment

# Deploy
fly deploy --app uncle-frank-claude --no-cache

echo ""
echo "✅ Deployed! Testing..."
sleep 5

# Test health
echo "Health check:"
curl -s https://uncle-frank-claude.fly.dev/health | jq '.'

echo ""
echo "✅ Ready to test!"