#!/bin/bash

# ENDLESS IMPROVEMENT LOOP
# Runs dev-redteam cycle continuously until interrupted
# The loop will:
# 1. Red team finds gaps
# 2. Developer fixes issues
# 3. Repeat forever

echo "🔄 Starting Endless Improvement Loop"
echo "Press Ctrl+C to stop"
echo "=================================="

LOOP_COUNT=0
LOG_FILE="improvement-loop.log"

# Create log file
echo "Improvement Loop Started: $(date)" > $LOG_FILE

while true; do
    LOOP_COUNT=$((LOOP_COUNT + 1))
    echo ""
    echo "🔄 ITERATION $LOOP_COUNT - $(date)"
    echo "=================================="
    
    # Step 1: Red Team Analysis
    echo "🔴 RED TEAM ANALYSIS..."
    echo "Analyzing gaps between current system and target docs..."
    
    # Create a temporary file for the red team analysis
    RED_TEAM_OUTPUT="/tmp/redteam-analysis-$LOOP_COUNT.md"
    
    # Use Claude to do red team analysis
    cat > /tmp/redteam-prompt.txt << 'EOF'
You are a red team security analyst. Analyze the gaps between:
1. Current implementation in /Users/don/UncleFrank/unclefrank-bootstrap
2. Target documentation in /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/

Focus on:
- Missing core functionality from Claude.md
- Incomplete workflow implementations
- Security vulnerabilities
- Performance issues
- Architectural flaws

Be brutally honest. List the TOP 3 most critical issues that need fixing RIGHT NOW.
Format as:
1. ISSUE: [description]
   FIX: [specific action to take]
   FILE: [file to modify]
EOF

    # Run red team analysis
    claude chat < /tmp/redteam-prompt.txt > $RED_TEAM_OUTPUT 2>&1
    
    # Display results
    echo "Red Team found issues:"
    cat $RED_TEAM_OUTPUT
    
    # Log it
    echo "=== Iteration $LOOP_COUNT Red Team ===" >> $LOG_FILE
    cat $RED_TEAM_OUTPUT >> $LOG_FILE
    
    # Step 2: Developer Fixes
    echo ""
    echo "🔨 DEVELOPER FIXING ISSUES..."
    
    # Create fix prompt
    cat > /tmp/dev-prompt.txt << EOF
You are a senior developer. The red team found these issues:

$(cat $RED_TEAM_OUTPUT)

Pick the MOST CRITICAL issue and implement a fix for it.
Make actual code changes to fix the problem.
Be specific and write real code.
Test your fix if possible.

After fixing, explain what you did.
EOF

    # Run developer fix
    DEV_OUTPUT="/tmp/dev-fix-$LOOP_COUNT.md"
    claude chat < /tmp/dev-prompt.txt > $DEV_OUTPUT 2>&1
    
    echo "Developer response:"
    cat $DEV_OUTPUT
    
    # Log it
    echo "=== Iteration $LOOP_COUNT Developer ===" >> $LOG_FILE
    cat $DEV_OUTPUT >> $LOG_FILE
    
    # Step 3: Commit changes if any
    if git diff --quiet; then
        echo "📝 No code changes made this iteration"
    else
        echo "💾 Committing changes..."
        git add -A
        git commit -m "Improvement Loop Iteration $LOOP_COUNT

Red Team Issues Fixed:
$(head -n 5 $RED_TEAM_OUTPUT)

Developer Actions:
$(head -n 5 $DEV_OUTPUT)

Automated by Endless Improvement Loop" 2>&1
        
        # Optional: Push to GitHub
        # git push origin master
    fi
    
    # Step 4: Brief pause before next iteration
    echo ""
    echo "⏸️  Waiting 30 seconds before next iteration..."
    echo "Press Ctrl+C to stop the loop"
    sleep 30
    
    # Clean up temp files
    rm -f /tmp/redteam-prompt.txt /tmp/dev-prompt.txt
    
done

echo "Loop terminated by user"