# Terragon Chat Integration

## Overview
The UncleFrank platform now includes integrated Terragon chat functionality, allowing real-time conversations with AI agents while maintaining the platform's no-BS philosophy.

## Features
- Real-time message polling (HTTP-based, no WebSocket required)
- Auto-reply patterns with Brooklyn personality
- Session management
- Message history tracking
- CLI and API interfaces

## Usage

### CLI Chat Mode
```bash
# Start a new chat session
npm run execute chat

# Continue existing chat session
npm run execute chat 6ebd46a9-0894-4055-a9db-b7e503d36387
```

### API Endpoints

#### Send Message
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "6ebd46a9-0894-4055-a9db-b7e503d36387",
    "message": "where you from in bk?"
  }'
```

#### Get Messages
```bash
curl http://localhost:3000/api/chat?threadId=6ebd46a9-0894-4055-a9db-b7e503d36387
```

### Programmatic Usage

```typescript
import { ChatService } from './src/services/chat-service';

// Initialize service
const chatService = new ChatService(process.env.TERRAGON_AUTH);

// Create session with auto-reply
const threadId = await chatService.createSession({
  autoReply: true,
  patterns: ChatService.getBrooklynPatterns()
});

// Listen to events
chatService.on('message:received', (message) => {
  console.log('New message:', message.text);
});

chatService.on('error', (error) => {
  console.error('Chat error:', error);
});

// Send message
await chatService.sendMessage(threadId, "Hey, what's your deal?");
```

## Environment Setup

Make sure `TERRAGON_AUTH` is set in your environment:

```bash
export TERRAGON_AUTH="your-session-token"
```

To get your session token:
1. Log into terragonlabs.com
2. Open browser DevTools
3. Look for cookie: `__Secure-better-auth.session_token`

## Chat Commands (CLI Mode)
- `/quit` - Exit chat mode
- `/clear` - Clear screen and message history

## Auto-Reply Patterns

The system includes Brooklyn-themed auto-reply patterns:
- Questions about Brooklyn neighborhoods
- Work/task inquiries
- General help requests

## Integration with Task System

Chat sessions can be linked to task execution:

```typescript
// Execute task with chat feedback
const task = await metaAgent.decomposeTask(request);
const chatThreadId = await chatService.createSession();

// Link chat to task execution
task.terragonSessionId = chatThreadId;
```

## Error Handling

The chat system handles:
- Network failures with retry logic
- Session timeouts
- Invalid thread IDs
- Rate limiting (built-in delays)

## Message Format

Messages follow Terragon's expected format:
```json
{
  "threadId": "thread-id",
  "message": {
    "type": "user",
    "model": "sonnet",
    "parts": [{
      "type": "rich-text",
      "nodes": [{
        "type": "text",
        "text": "Your message here"
      }]
    }],
    "timestamp": "2025-08-03T18:21:33.135Z"
  }
}
```

## Brooklyn Personality

All responses maintain Uncle Frank's Brooklyn personality:
- Direct, no-nonsense communication
- Brooklyn neighborhood references
- Skepticism of corporate BS
- Focus on getting things done

## Troubleshooting

1. **Authentication Failed**: Check your TERRAGON_AUTH token
2. **No Messages Received**: Verify thread ID exists
3. **Polling Errors**: Check network connectivity
4. **Rate Limits**: Built-in delays prevent this, but reduce polling interval if needed