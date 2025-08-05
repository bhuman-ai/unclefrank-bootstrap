#!/bin/bash

echo "🧹 Cleaning up Terragon remnants..."

# Remove all test files related to Terragon
rm -f test-terragon-*.js
rm -f test-decomp*.js
rm -f test-decompose*.js
rm -f test-orchestrator*.js
rm -f test-final-*.js
rm -f test-working-*.js
rm -f test-consecutive-messages.js
rm -f test-fresh-thread.js
rm -f test-all-messages.js
rm -f test-simple-send.js
rm -f test-message-send.js
rm -f test-raw-fetch.js
rm -f test-manual-decompose.js
rm -f send-decomp-now.js
rm -f show-all-messages.js
rm -f check-decomposition.js
rm -f check-latest-messages.js
rm -f api/test-terragon-fetch.js
rm -f api/test-session-cookies.js
rm -f api/test-manual-decomp.js
rm -f api/test-send-message.js
rm -f api/monitor-terragon.js
rm -f api/inspect-terragon.js
rm -f api/deep-inspect.js
rm -f api/test-completion.js
rm -f api/debug-status.js
rm -f TERRAGON-API-NOTES.md
rm -f docs/terragon-chat.md
rm -f execute-review-ui-task.js
rm -f verify-api.js

# Remove TypeScript files that reference Terragon
rm -f src/core/terragon-proxy.ts

echo "✅ Removed Terragon test and debug files"

# Count remaining references
echo ""
echo "📊 Remaining Terragon references:"
grep -r "terragon\|Terragon" . --exclude-dir=.git --exclude-dir=node_modules --exclude="cleanup-terragon.sh" | wc -l