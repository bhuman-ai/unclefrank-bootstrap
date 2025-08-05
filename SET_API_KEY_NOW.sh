#!/bin/bash

# Quick script to set Anthropic API key

echo "🔑 Setting Anthropic API key for Claude Executor..."

# You need to replace this with your actual API key
API_KEY="your-anthropic-api-key-here"

# Set the secret
fly secrets set ANTHROPIC_API_KEY="$API_KEY" -a uncle-frank-claude

echo "✅ API key set! The app will restart automatically."
echo ""
echo "Wait 30 seconds, then test with:"
echo "node test-claude-integration.js"