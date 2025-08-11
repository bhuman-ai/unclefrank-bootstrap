#!/bin/bash

# THE SIMPLEST LOOP THAT ACTUALLY FUCKING WORKS
# Using Claude CLI - no API key bullshit

echo "🚀 STARTING THE BRUTAL SIMPLE LOOP"
echo "=================================="

# Create initial files if they don't exist
if [ ! -f "target.md" ]; then
    cat > target.md << 'EOF'
# Target: Build FrankForge

Create a working system with:
1. A simple web page that shows tasks
2. A way to add tasks
3. A way to execute tasks with Claude
4. Auto-improve that finds gaps and fixes them

Start simple. Make it work. Then make it better.
EOF
fi

if [ ! -f "current.md" ]; then
    echo "# Current State" > current.md
    echo "" >> current.md
    echo "Nothing built yet." >> current.md
fi

ITERATION=0

# THE LOOP
while true; do
    ITERATION=$((ITERATION + 1))
    
    echo ""
    echo "=========================================="
    echo "ITERATION $ITERATION"
    echo "=========================================="
    
    # Read current state
    TARGET=$(cat target.md)
    CURRENT=$(cat current.md)
    
    # Find ONE thing to do
    echo "🤔 Finding next step..."
    
    NEXT_STEP=$(claude --no-conversation "
Target state:
$TARGET

Current state:
$CURRENT

What is ONE SPECIFIC small file to create or update next?
Be concrete. Give me a filename and what it should do.
Keep it SIMPLE. One file at a time.
Just tell me: FILENAME: xxx.js/html/md and what it does.
")
    
    echo "📋 Next step: $NEXT_STEP"
    
    # Build it
    echo "🔨 Building..."
    
    BUILD_OUTPUT=$(claude --no-conversation "
Current state:
$CURRENT

Build this: $NEXT_STEP

Give me the COMPLETE FILE CONTENT.
Start with:
FILENAME: [actual filename]
Then the entire file content.
Make it WORK. No placeholders. Real code.
")
    
    # Extract filename and content
    FILENAME=$(echo "$BUILD_OUTPUT" | head -1 | sed 's/FILENAME: //')
    CONTENT=$(echo "$BUILD_OUTPUT" | tail -n +2)
    
    # Save it
    if [ ! -z "$FILENAME" ]; then
        echo "💾 Creating $FILENAME"
        echo "$CONTENT" > "$FILENAME"
        
        # Update current.md
        echo "" >> current.md
        echo "## Iteration $ITERATION" >> current.md
        echo "Created: $FILENAME" >> current.md
        
        echo "✅ Done with iteration $ITERATION"
    fi
    
    echo ""
    echo "Waiting 5 seconds... (Press Ctrl+C to stop)"
    sleep 5
done