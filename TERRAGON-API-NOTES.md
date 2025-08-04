# Terragon API Integration Notes

## Summary of Findings

### What Works ✅
1. **Creating Terragon tasks** - Works reliably via the dashboard endpoint
2. **Fetching messages** - Works with updated headers (next-action and x-deployment-id)
3. **Message sending sometimes works** - The `send-terragon-message.js` endpoint can send messages, but success is inconsistent

### What Doesn't Work Reliably ❌
1. **Consistent message sending** - Session state changes between requests cause digest errors
2. **Automated multi-message conversations** - Can't reliably send multiple messages in sequence

### Key Discovery
The `send-terragon-message.js` endpoint works by:
1. First doing a fetch to establish/refresh session
2. Then sending the actual message with updated headers

However, this doesn't work consistently across different sessions and time gaps.

### Working Headers
```javascript
// For fetching (reading messages)
headers: {
  'accept': 'text/x-component',
  'content-type': 'text/plain;charset=UTF-8',
  'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
  'next-action': '7f7f75ac3cce9016222850cb0f9b89dacfcdb75c9b',
  'origin': 'https://www.terragonlabs.com',
  'referer': `https://www.terragonlabs.com/task/${threadId}`,
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'x-deployment-id': 'dpl_EcYagrYkth26MSww72T3G2EZGiUH'
}
```

### Session State Issue
Terragon uses complex session management with multiple cookies that change between requests:
- `__Secure-better-auth.session_token` (we have this)
- Various session IDs that rotate (we don't have these)
- Digest validation that requires proper session context

### Current Limitations
1. **No reliable way to maintain session state** between API calls
2. **Digest errors** when session context is missing
3. **Inconsistent success** - sometimes works, often fails

### Recommendations
1. **For monitoring**: The orchestrator can reliably monitor Terragon instances
2. **For decision making**: The orchestrator can analyze and make decisions
3. **For message sending**: Success is not guaranteed - consider this experimental
4. **For production use**: Would need proper API endpoints from Terragon or browser automation

### Task Orchestrator Status
- ✅ Monitors Terragon instances
- ✅ Makes intelligent decisions
- ✅ Parses LLM responses
- ⚠️  Sends messages (works sometimes)
- ❌ Reliable multi-message automation

The system is functional for monitoring and decision-making, but message sending reliability depends on Terragon's session requirements.