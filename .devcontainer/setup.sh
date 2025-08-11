#!/bin/bash

echo "🚀 Setting up Uncle Frank's Auto-Improve System"

# Install Claude CLI
echo "📦 Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-cli

# Create initial files
cat > target.md << 'EOF'
# Target: FrankForge Platform

Build a system that:
1. Has a web dashboard showing progress
2. Can execute tasks automatically
3. Finds gaps between target and current
4. Builds solutions incrementally
5. Actually fucking works

Start simple. One file at a time.
EOF

cat > current.md << 'EOF'
# Current State

Nothing built yet.
EOF

# Create the actual simple loop
cat > simple-loop.sh << 'EOF'
#!/bin/bash

ITERATION=0

while true; do
    ITERATION=$((ITERATION + 1))
    echo "========================================"
    echo "ITERATION $ITERATION"
    echo "========================================"
    
    # Read state
    TARGET=$(cat target.md)
    CURRENT=$(cat current.md)
    
    # Find gap
    echo "🤔 Finding next step..."
    NEXT_STEP=$(claude --print "Target: $TARGET\n\nCurrent: $CURRENT\n\nWhat's ONE specific file to create next? Just name the file and its purpose.")
    
    echo "📋 Next: $NEXT_STEP"
    
    # Build it
    echo "🔨 Building..."
    claude --print "Build this completely: $NEXT_STEP\n\nMake it work. No placeholders." > output.tmp
    
    # Parse and save
    FILENAME=$(echo "$NEXT_STEP" | grep -oE '[a-z-]+\.(html|js|css|md)' | head -1)
    if [ ! -z "$FILENAME" ]; then
        mv output.tmp "$FILENAME"
        echo "💾 Created $FILENAME"
        
        # Update current.md
        echo "" >> current.md
        echo "## Iteration $ITERATION" >> current.md
        echo "Created: $FILENAME" >> current.md
    fi
    
    echo "✅ Done. Waiting 10 seconds..."
    sleep 10
done
EOF

chmod +x simple-loop.sh

echo "✅ Setup complete!"
echo ""
echo "To start the auto-improve loop:"
echo "  ./simple-loop.sh"
echo ""
echo "To run one step at a time:"
echo "  claude --print 'Create a simple task tracker HTML file' > task.html"