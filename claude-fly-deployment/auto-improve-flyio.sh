#!/bin/bash

# AUTO-IMPROVE SYSTEM FOR FLY.IO
# Runs continuously on Fly.io server, pulls from GitHub, makes improvements, pushes back

echo "🔄 AUTO-IMPROVE SYSTEM (Fly.io Version)"
echo "========================================"
echo "Running on Fly.io - will continue even when your computer is off"
echo ""

# Setup Git credentials
setup_git() {
    git config --global user.name "Uncle Frank Bot"
    git config --global user.email "frank@unclefrank.ai"
    
    # Use GitHub token for auth (already set in Fly.io env)
    if [ -n "$GITHUB_TOKEN" ]; then
        git config --global credential.helper store
        echo "https://${GITHUB_TOKEN}@github.com" > ~/.git-credentials
        echo "✅ Git configured with GitHub token"
    else
        echo "⚠️ No GITHUB_TOKEN found, push may fail"
    fi
}

# Clone or update repo
setup_repo() {
    REPO_DIR="/tmp/unclefrank-bootstrap"
    
    if [ -d "$REPO_DIR" ]; then
        echo "📥 Updating existing repo..."
        cd "$REPO_DIR"
        git pull origin master
    else
        echo "📥 Cloning repo..."
        git clone https://github.com/bhuman-ai/unclefrank-bootstrap.git "$REPO_DIR"
        cd "$REPO_DIR"
    fi
    
    echo "📁 Working in: $(pwd)"
}

# Main improvement loop
run_improvement_loop() {
    ITERATION=0
    
    while true; do
        ITERATION=$((ITERATION + 1))
        
        echo ""
        echo "========================================="
        echo "🔄 ITERATION $ITERATION - $(date)"
        echo "========================================="
        
        # Pull latest changes
        echo "📥 Pulling latest from GitHub..."
        git pull origin master
        
        # Step 1: Analyze gaps using Claude in tmux
        echo "🔴 Analyzing gaps..."
        
        # Create analysis prompt
        cat > /tmp/analysis.txt << 'EOF'
Compare target docs in /tmp/unclefrank-bootstrap/docs to work towards/:
- claude.md: Immutable flow (Draft → Validation → Task → Checkpoint → Review → Merge)
- task.md: Task breakdown structure

With current implementation in /tmp/unclefrank-bootstrap/:
- Project.md (current state)
- pages/api/* (actual endpoints)
- src/* (implementation)

Find the #1 MOST CRITICAL missing feature that violates the immutable flow.

Output as:
ISSUE: [specific missing feature]
FILE: [exact file path to create/modify]
SEVERITY: CRITICAL
FIX: [brief description of fix]
EOF
        
        # Send to Claude via tmux
        tmux send-keys -t claude-manual C-c 2>/dev/null
        sleep 1
        tmux send-keys -t claude-manual "cat /tmp/analysis.txt" Enter
        sleep 5
        
        # Capture Claude's response
        tmux capture-pane -t claude-manual -p > /tmp/claude-response.txt
        tail -20 /tmp/claude-response.txt
        
        # Step 2: Implement fix
        echo ""
        echo "🔨 Implementing fix..."
        
        cat > /tmp/fix-prompt.txt << 'EOF'
Based on the gap analysis, write ACTUAL CODE to fix the issue.
Create a complete working implementation.
Focus on one specific file and make it production-ready.
Output the exact file content, no explanations.
EOF
        
        tmux send-keys -t claude-manual C-c 2>/dev/null
        sleep 1
        tmux send-keys -t claude-manual "cat /tmp/fix-prompt.txt" Enter
        sleep 8
        
        # Capture fix
        tmux capture-pane -t claude-manual -p > /tmp/claude-fix.txt
        
        echo "Fix captured"
        
        # Step 3: Commit and push if changes exist
        cd "$REPO_DIR"
        
        if ! git diff --quiet; then
            echo "💾 Committing changes..."
            git add -A
            git commit -m "Auto-improve: Iteration $ITERATION (Fly.io)

Automated improvement from Fly.io server.
Gap analysis and fix applied.

Bot: Uncle Frank Auto-Improve" 2>&1
            
            echo "📤 Pushing to GitHub..."
            if git push origin master; then
                echo "✅ Successfully pushed to GitHub"
                echo "🌐 Vercel will auto-deploy in ~2 minutes"
            else
                echo "❌ Push failed - check GitHub token"
            fi
        else
            echo "📝 No changes to commit"
        fi
        
        # Step 4: Status report
        echo ""
        echo "📊 Status Report:"
        echo "  - Iteration: $ITERATION"
        echo "  - Time: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "  - Next run in 2 minutes..."
        
        # Wait before next iteration
        sleep 120
    done
}

# Main execution
echo "🚀 Starting Auto-Improve on Fly.io"
setup_git
setup_repo
run_improvement_loop