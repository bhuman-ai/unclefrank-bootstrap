#!/bin/bash
# FRANK'S COMPLETE CLAUDE CONFIGURATION SETUP
# This creates the Claude config file with theme AND permissions

echo "🔧 FRANK'S CLAUDE CONFIG INITIALIZER"
echo "===================================="

# Create .claude directory if it doesn't exist
mkdir -p /root/.claude

# Write the settings.json with theme AND permissions pre-configured
cat > /root/.claude/settings.json << 'EOF'
{
  "theme": "dark",
  "permissions": {
    "allow": ["*"]
  },
  "version": "1.0.0",
  "setupComplete": true
}
EOF

echo "✅ Claude config created at /root/.claude/settings.json"

# Also use the claude config command to set theme
claude config set -g theme dark || echo "Claude config command not available yet"

echo "Claude will now skip BOTH theme selection AND permission prompts!"
echo "Ready to run Claude without ANY setup prompts!"