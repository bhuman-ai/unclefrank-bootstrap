#!/bin/bash
# FRANK'S ONE-TIME CLAUDE CONFIGURATION SETUP
# This creates the Claude config file so it never asks for theme again

echo "🔧 FRANK'S CLAUDE CONFIG INITIALIZER"
echo "===================================="

# Create .claude directory if it doesn't exist
mkdir -p /root/.claude

# Write the settings.json with theme pre-selected
cat > /root/.claude/settings.json << 'EOF'
{
  "theme": "dark",
  "version": "1.0.0",
  "setupComplete": true
}
EOF

echo "✅ Claude config created at /root/.claude/settings.json"
echo "Claude will now skip theme selection on all future runs!"

# Also create a global config
mkdir -p /etc/claude
cp /root/.claude/settings.json /etc/claude/settings.json

echo "✅ Global config also created at /etc/claude/settings.json"
echo "Ready to run Claude without setup prompts!"