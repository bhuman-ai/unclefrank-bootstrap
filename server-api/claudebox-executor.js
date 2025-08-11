// FRANK'S CLAUDEBOX EXECUTOR - Docker-based Claude execution
// Replaces both Claude and manual VM setup

const CLAUDEBOX_URL = process.env.CLAUDEBOX_URL || 'http://localhost:3000';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, payload } = req.body;

  try {
    switch (action) {
      case 'create-task': {
        // Extract task from Claude-style payload
        const taskData = payload[0];
        const taskMessage = taskData.message.parts[0].text;
        
        // Create session in Claudebox
        const sessionResponse = await fetch(`${CLAUDEBOX_URL}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`
          },
          body: JSON.stringify({
            message: taskMessage,
            model: 'claude-3-opus-20240229',
            temperature: 0.2,
            maxTokens: 4096
          })
        });

        if (!sessionResponse.ok) {
          throw new Error(`Claudebox error: ${sessionResponse.status}`);
        }

        const session = await sessionResponse.json();
        console.log(`[Claudebox] Created session: ${session.id}`);

        return res.status(200).json({
          success: true,
          threadId: session.id,
          executor: 'claudebox',
          url: `${CLAUDEBOX_URL}/session/${session.id}`
        });
      }

      case 'check-status': {
        const { threadId } = payload;
        
        // Get session status from Claudebox
        const statusResponse = await fetch(`${CLAUDEBOX_URL}/api/sessions/${threadId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`
          }
        });

        if (!statusResponse.ok) {
          throw new Error(`Claudebox error: ${statusResponse.status}`);
        }

        const session = await statusResponse.json();
        
        // Determine if completed based on response
        const lastMessage = session.messages?.[session.messages.length - 1];
        const completed = lastMessage?.role === 'assistant' && 
                         (lastMessage.content.includes('completed') || 
                          lastMessage.content.includes('done'));

        return res.status(200).json({
          threadId,
          status: completed ? 'completed' : 'active',
          completed,
          messageCount: session.messages?.length || 0,
          lastResponse: lastMessage?.content || null,
          url: `${CLAUDEBOX_URL}/session/${threadId}`,
          executor: 'claudebox'
        });
      }

      case 'get-code': {
        const { threadId } = payload;
        
        // Get generated code from Claudebox workspace
        const filesResponse = await fetch(`${CLAUDEBOX_URL}/api/sessions/${threadId}/files`, {
          headers: {
            'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`
          }
        });

        if (!filesResponse.ok) {
          throw new Error(`Claudebox error: ${filesResponse.status}`);
        }

        const files = await filesResponse.json();

        return res.status(200).json({
          success: true,
          files: files,
          executor: 'claudebox'
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[Claudebox] Error:', error);
    return res.status(500).json({
      error: 'Claudebox execution error',
      details: error.message
    });
  }
}