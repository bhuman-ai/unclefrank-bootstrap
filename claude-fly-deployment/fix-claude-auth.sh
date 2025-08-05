#!/bin/bash

# Fix Claude authentication on Fly.io

echo "🔧 Fixing Claude authentication issue"
echo "===================================="
echo ""
echo "The 'claude login' command is hanging because it can't open a browser."
echo "Here are some alternatives to try:"
echo ""
echo "1. Try running with --no-browser flag:"
echo "   claude login --no-browser"
echo ""
echo "2. If that doesn't work, check for a URL in the output:"
echo "   Look for something like: https://claude.ai/auth/..."
echo ""
echo "3. Try using the API key method instead:"
echo "   Exit the SSH session (Ctrl+C then 'exit')"
echo "   Then run: fly secrets set ANTHROPIC_API_KEY='your-key' -a uncle-frank-claude"
echo ""
echo "4. Check if Claude is already authenticated:"
echo "   claude --version"
echo "   claude chat"
echo ""

# Alternative: Use API key directly
echo "To set API key from outside the container:"
echo "fly secrets set ANTHROPIC_API_KEY='sk-ant-...' -a uncle-frank-claude"