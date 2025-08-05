#!/bin/bash

# Setup script to configure Claude as the only executor

echo "🚀 Configuring Uncle Frank Bootstrap for Claude-only execution"
echo "============================================================="

# Remove Terragon environment variables
echo "🗑️ Removing Terragon configuration..."
vercel env rm TERRAGON_AUTH --yes 2>/dev/null || true
vercel env rm USE_CLAUDE_EXECUTOR --yes 2>/dev/null || true
vercel env rm CLAUDE_ROLLOUT_PERCENTAGE --yes 2>/dev/null || true

# Set Claude configuration
echo "✅ Setting Claude configuration..."
vercel env add CLAUDE_EXECUTOR_URL production <<< "https://uncle-frank-claude.fly.dev"

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Deploy to Vercel: vercel --prod"
echo "   2. Test the system: node test-claude-integration.js"
echo ""
echo "🎉 Terragon has been completely removed!"
echo "   All tasks now execute through Claude on Fly.io"