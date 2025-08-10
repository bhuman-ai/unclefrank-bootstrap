#!/bin/bash

# ENDLESS IMPROVEMENT WITH AGENT SPAWNING
# Uses Claude Code's Task tool to spawn redteam and developer agents

echo "🔄 ENDLESS IMPROVEMENT SYSTEM"
echo "============================="
echo "This will run forever until you press Ctrl+C"
echo ""

ITERATION=0

# Function to run red team analysis
run_redteam() {
    echo "🔴 Running Red Team Analysis..."
    
    # Create a command file for Claude to execute
    cat > /tmp/redteam-task.txt << 'EOF'
/task adversarial-tester "Analyze the gaps between the current implementation at /Users/don/UncleFrank/unclefrank-bootstrap and the target documentation in /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/. Focus on: 1) Missing core functionality from Claude.md (immutable flow: Draft → Validation → Task → Checkpoint → Review → Merge), 2) Broken or incomplete implementations, 3) Security vulnerabilities, 4) Architectural flaws. Be brutally honest and specific. List the TOP 5 CRITICAL issues with file paths and exact fixes needed."
EOF
    
    # Execute via Claude
    claude < /tmp/redteam-task.txt > /tmp/redteam-output.txt 2>&1
    
    echo "Red Team Analysis Complete"
    echo "---"
    cat /tmp/redteam-output.txt | head -50
    echo "---"
}

# Function to run developer fixes
run_developer() {
    echo "🔨 Running Developer Fix..."
    
    # Create developer task based on red team output
    cat > /tmp/dev-task.txt << EOF
/task backend-architect "Based on this red team analysis, implement fixes for the most critical issue found:

$(cat /tmp/redteam-output.txt | head -30)

Requirements:
1. Pick the MOST CRITICAL issue
2. Write actual code to fix it
3. Create or modify necessary files
4. Follow the immutable flow from Claude.md
5. Make it production-ready

Focus on one issue at a time and fix it completely."
EOF
    
    # Execute via Claude
    claude < /tmp/dev-task.txt > /tmp/dev-output.txt 2>&1
    
    echo "Developer Fix Complete"
    echo "---"
    cat /tmp/dev-output.txt | head -50
    echo "---"
}

# Function to commit changes
commit_changes() {
    if git diff --quiet; then
        echo "📝 No changes to commit"
    else
        echo "💾 Committing changes..."
        git add -A
        git commit -m "Autonomous Improvement - Iteration $ITERATION

Red Team found critical issues.
Developer implemented fixes.

Automated by Endless Improvement Loop" 2>&1
    fi
}

# Main loop
while true; do
    ITERATION=$((ITERATION + 1))
    
    echo ""
    echo "=========================================="
    echo "🔄 ITERATION $ITERATION - $(date)"
    echo "=========================================="
    
    # Run red team
    run_redteam
    
    # Short pause
    sleep 5
    
    # Run developer
    run_developer
    
    # Commit any changes
    commit_changes
    
    # Log progress
    echo ""
    echo "✅ Iteration $ITERATION Complete"
    echo "📊 Stats:"
    echo "  - Red team analysis: Complete"
    echo "  - Developer fix: Complete"
    echo "  - Changes committed: $(git diff --quiet && echo 'No' || echo 'Yes')"
    
    # Pause before next iteration
    echo ""
    echo "⏸️  Waiting 30 seconds before next iteration..."
    echo "Press Ctrl+C to stop"
    sleep 30
done