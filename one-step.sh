#!/bin/bash

# Just do ONE FUCKING STEP to prove it works

echo "🎯 ONE STEP DEMO - BUILD SOMETHING NOW"

# What we want
TARGET="Build a simple task system that actually works"

# What we have  
CURRENT="Nothing yet"

# Get Claude to tell us what to build
echo "📋 Asking Claude what to build first..."

RESPONSE=$(claude --no-conversation --print "
Target: $TARGET
Current: $CURRENT

Give me ONE simple HTML file that shows a task list.
Start with 'FILENAME: ' then the complete HTML.
Make it work standalone. No dependencies.
")

# Extract filename and save it
echo "$RESPONSE" | head -1
FILENAME=$(echo "$RESPONSE" | head -1 | cut -d: -f2 | xargs)
CONTENT=$(echo "$RESPONSE" | tail -n +2)

echo "💾 Creating $FILENAME"
echo "$CONTENT" > "$FILENAME"

echo "✅ DONE! Open $FILENAME in your browser"
echo ""
echo "THIS is how simple it should be. Now let's make it loop."