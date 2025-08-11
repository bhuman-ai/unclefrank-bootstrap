// FRANK'S CLAUDE-CODE-REMOTE EXECUTOR
// Replaces Claude with Claude-Code-Remote for task execution

const CLAUDE_REMOTE_URL = process.env.CLAUDE_REMOTE_URL || 'http://207.148.12.169:3000';
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;

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
      case 'create-session': {
        // Create a new Claude-Code-Remote session
        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CLAUDE_API_KEY}`
          },
          body: JSON.stringify({
            projectPath: payload.projectPath || '/workspace',
            model: payload.model || 'claude-3-opus-20240229',
            systemPrompt: payload.systemPrompt || "You are Uncle Frank's task executor. No BS, just get it done."
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.status}`);
        }

        const session = await response.json();
        console.log(`[Claude-Remote] Created session: ${session.sessionId}`);

        return res.status(200).json({
          success: true,
          sessionId: session.sessionId,
          workspaceUrl: `${CLAUDE_REMOTE_URL}/workspace/${session.sessionId}`
        });
      }

      case 'execute-task': {
        const { sessionId, task, checkpoints } = payload;

        if (!sessionId || !task) {
          return res.status(400).json({ error: 'Session ID and task required' });
        }

        // Send task to Claude-Code-Remote
        const taskMessage = `# TASK EXECUTION REQUEST

## Task: ${task.name}

## Description:
${task.description}

## Acceptance Criteria:
${task.acceptanceCriteria}

## Checkpoints:
${checkpoints.map((cp, idx) => `
### Checkpoint ${idx + 1}: ${cp.name}
- **Objective:** ${cp.objective}
- **Test:** ${cp.test}
- **Instructions:** ${cp.instructions}
`).join('\n')}

Please execute these checkpoints in order. For each checkpoint:
1. Implement the required changes
2. Run the test to verify it passes
3. Commit your changes with a descriptive message
4. Move to the next checkpoint

Let me know when all checkpoints are complete.`;

        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CLAUDE_API_KEY}`
          },
          body: JSON.stringify({
            message: taskMessage,
            attachments: []
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to send task: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[Claude-Remote] Task sent to session ${sessionId}`);

        return res.status(200).json({
          success: true,
          messageId: result.messageId,
          sessionId: sessionId
        });
      }

      case 'check-status': {
        const { sessionId } = payload;

        if (!sessionId) {
          return res.status(400).json({ error: 'Session ID required' });
        }

        // Get session status and recent messages
        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/sessions/${sessionId}/status`, {
          headers: {
            'Authorization': `Bearer ${CLAUDE_API_KEY}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to check status: ${response.status}`);
        }

        const status = await response.json();

        // Parse completion from Claude's responses
        const completed = status.messages?.some(msg => 
          msg.content?.includes('all checkpoints are complete') ||
          msg.content?.includes('task completed successfully')
        );

        return res.status(200).json({
          sessionId: sessionId,
          status: status.active ? 'active' : 'idle',
          completed: completed,
          messageCount: status.messages?.length || 0,
          lastActivity: status.lastActivity,
          workspaceUrl: `${CLAUDE_REMOTE_URL}/workspace/${sessionId}`
        });
      }

      case 'get-changes': {
        const { sessionId } = payload;

        if (!sessionId) {
          return res.status(400).json({ error: 'Session ID required' });
        }

        // Get file changes from the session
        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/sessions/${sessionId}/changes`, {
          headers: {
            'Authorization': `Bearer ${CLAUDE_API_KEY}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to get changes: ${response.status}`);
        }

        const changes = await response.json();

        return res.status(200).json({
          success: true,
          changes: changes,
          sessionId: sessionId
        });
      }

      case 'export-workspace': {
        const { sessionId, format = 'git' } = payload;

        if (!sessionId) {
          return res.status(400).json({ error: 'Session ID required' });
        }

        // Export workspace as git patch or zip
        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/sessions/${sessionId}/export?format=${format}`, {
          headers: {
            'Authorization': `Bearer ${CLAUDE_API_KEY}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to export workspace: ${response.status}`);
        }

        const exportData = await response.blob();
        const buffer = await exportData.arrayBuffer();

        // Return the export data
        res.setHeader('Content-Type', format === 'git' ? 'text/plain' : 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="workspace-${sessionId}.${format === 'git' ? 'patch' : 'zip'}"`);
        
        return res.status(200).send(Buffer.from(buffer));
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[Claude-Remote] Error:', error);
    return res.status(500).json({
      error: 'Claude-Remote execution error',
      details: error.message
    });
  }
}