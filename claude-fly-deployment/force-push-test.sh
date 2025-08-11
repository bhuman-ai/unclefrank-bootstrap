#!/bin/bash
# Force a test push to trigger Vercel

echo "🚀 FORCING TEST PUSH TO TRIGGER VERCEL"

# Clone repo
cd /tmp
rm -rf test-push
git clone https://github.com/bhuman-ai/unclefrank-bootstrap.git test-push
cd test-push

# Configure git
git config user.name "Uncle Frank Bot"
git config user.email "frank@unclefrank.ai"

# Create a test file with timestamp
echo "Auto-improve test: $(date)" > auto-improve-test.txt

# Commit and push
git add -A
git commit -m "Test: Force push to trigger Vercel deployment

Testing if GitHub → Vercel pipeline is working.
Generated at: $(date)"

# Push with token
if [ -n "$GITHUB_TOKEN" ]; then
    git push https://${GITHUB_TOKEN}@github.com/bhuman-ai/unclefrank-bootstrap.git master
    echo "✅ Pushed to GitHub! Check Vercel for deployment."
else
    echo "❌ No GITHUB_TOKEN set"
fi