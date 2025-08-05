#!/bin/bash

# FRANK'S CLAUDE INTEGRATION DEPLOYMENT

echo "🚀 Deploying Claude Integration to Vercel"
echo "========================================"

# Set environment variables
echo "📋 Setting environment variables..."

# Claude Executor URL
vercel env add CLAUDE_EXECUTOR_URL production <<< "https://uncle-frank-claude.fly.dev"

# Enable Claude
vercel env add USE_CLAUDE_EXECUTOR production <<< "true"

# Rollout percentage (start with 10%)
vercel env add CLAUDE_ROLLOUT_PERCENTAGE production <<< "10"

# Deploy
echo "🚀 Deploying to production..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Test with: node test-claude-integration.js"
echo "   2. Monitor logs: vercel logs"
echo "   3. Increase rollout: vercel env add CLAUDE_ROLLOUT_PERCENTAGE production"
echo ""
echo "🔗 Integration endpoints:"
echo "   - /api/claude-executor-integration"
echo "   - /api/execute-claude (hybrid router)"