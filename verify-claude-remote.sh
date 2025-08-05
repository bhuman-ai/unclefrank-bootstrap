#!/bin/bash

# FRANK'S CLAUDE-REMOTE VERIFICATION SCRIPT

echo "🔍 Verifying Claude-Code-Remote Setup"
echo "====================================="

REMOTE_HOST="207.148.12.169"
REMOTE_PORT="3000"

# Check if host is reachable
echo -n "1. Checking host connectivity... "
if ping -c 1 -W 2 $REMOTE_HOST > /dev/null 2>&1; then
    echo "✅ Host is reachable"
else
    echo "❌ Cannot reach host"
    exit 1
fi

# Check if port is open
echo -n "2. Checking if port $REMOTE_PORT is open... "
if nc -z -w 2 $REMOTE_HOST $REMOTE_PORT 2>/dev/null; then
    echo "✅ Port is open"
else
    echo "❌ Port is closed"
    echo "   Run setup script on the server first"
    exit 1
fi

# Check API endpoint
echo -n "3. Checking API endpoint... "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$REMOTE_PORT/api/health 2>/dev/null)
if [ "$RESPONSE" = "200" ]; then
    echo "✅ API is responding"
else
    echo "❌ API returned status: $RESPONSE"
fi

# Test creating a session (requires API key)
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -n "4. Testing session creation... "
    SESSION_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
        -d '{"projectPath":"/workspace/test"}' \
        http://$REMOTE_HOST:$REMOTE_PORT/api/sessions)
    
    if echo "$SESSION_RESPONSE" | grep -q "sessionId"; then
        echo "✅ Can create sessions"
        SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
        echo "   Session ID: $SESSION_ID"
    else
        echo "❌ Cannot create sessions"
        echo "   Response: $SESSION_RESPONSE"
    fi
else
    echo "4. Skipping session test (no API key set)"
fi

echo ""
echo "📋 Summary:"
echo "   Claude-Remote URL: http://$REMOTE_HOST:$REMOTE_PORT"
echo "   Status: $([ "$RESPONSE" = "200" ] && echo "🟢 Online" || echo "🔴 Offline")"
echo ""
echo "🔧 Next steps:"
echo "   1. Set ANTHROPIC_API_KEY environment variable"
echo "   2. Update CLAUDE_REMOTE_URL in Vercel"
echo "   3. Deploy execute-v2.js to use hybrid executor"
echo "   4. Test with executor='claude-remote' parameter"