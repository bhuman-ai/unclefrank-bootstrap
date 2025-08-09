#!/bin/bash
# CRITICAL: Push all local changes before deploying/running tasks

echo "🔄 Uncle Frank's Repo Sync - Making sure Claude sees everything"
echo "============================================================"

# 1. Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Found uncommitted changes. Committing them now..."
    git add -A
    git commit -m "Auto-commit: Sync local changes before Claude task execution

    This ensures Claude sees the latest code state.
    
    🤖 Generated with [Claude Code](https://claude.ai/code)
    Co-Authored-By: Claude <noreply@anthropic.com>"
    echo "✅ Changes committed"
else
    echo "✅ No uncommitted changes"
fi

# 2. Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin master || {
    echo "❌ Failed to push. Trying to pull first..."
    git pull origin master --rebase
    git push origin master
}
echo "✅ GitHub is up to date"

# 3. Deploy to Fly.io if requested
if [ "$1" == "--deploy" ]; then
    echo "🚀 Deploying to Fly.io..."
    cd claude-fly-deployment
    fly deploy --yes
    cd ..
    echo "✅ Deployed to Fly.io"
fi

echo ""
echo "✅ Repository synced! Claude will now see the latest code."
echo "   You can now run tasks and Claude will have full context."