#!/bin/bash

echo "🧹 Removing ALL Terragon references and replacing with Claude..."

# Replace in public/index.html
sed -i.bak \
  -e 's/Terragon/Claude/g' \
  -e 's/terragon/claude/g' \
  -e 's/terragonlabs\.com/uncle-frank-claude.fly.dev/g' \
  -e 's/https:\/\/www\.claude\.com\/task/\/api\/sessions/g' \
  -e 's/Claude Thread/Claude Session/g' \
  -e 's/Claude thread/Claude session/g' \
  -e 's/Claude branches/Claude sessions/g' \
  -e 's/Monitor at: \/api\/sessions/View session:/g' \
  -e 's/claude\/project-/claude-session-/g' \
  public/index.html

# Replace in all API files
find api -name "*.js" -type f -exec sed -i.bak \
  -e 's/Terragon/Claude/g' \
  -e 's/terragon/claude/g' \
  -e 's/terragonlabs\.com/uncle-frank-claude.fly.dev/g' \
  {} \;

# Replace in other files
sed -i.bak 's/Terragon/Claude/g' README.md
sed -i.bak 's/terragon/claude/g' README.md

# Clean up backup files
find . -name "*.bak" -delete

echo "✅ Done! All Terragon references replaced with Claude"