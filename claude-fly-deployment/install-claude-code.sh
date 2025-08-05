#!/bin/bash

# Install and authenticate Claude Code on Fly.io

echo "🚀 Installing Claude Code on Fly.io server"
echo "========================================="

# Step 1: SSH into Fly.io and install Claude Code
echo "📦 Step 1: Installing Claude Code..."
echo ""
echo "Run these commands once connected:"
echo ""
echo "# Install Claude Code globally"
echo "npm install -g @anthropic-ai/claude-code"
echo ""
echo "# Verify installation"
echo "claude --version"
echo ""
echo "# Authenticate with your Anthropic account"
echo "claude login"
echo ""
echo "# Test it works"
echo "claude chat"
echo ""
echo "# When done, type 'exit' to disconnect"
echo ""
echo "Press Enter to connect to Fly.io..."
read

# Connect to Fly.io
fly ssh console -a uncle-frank-claude