// FRANK'S HYBRID EXECUTOR - Supports both Terragon and Claude-Remote
// Gradually migrate from Terragon to Claude-Remote

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

  const { action, payload, executor = 'terragon' } = req.body;

  // Route to appropriate executor
  if (executor === 'claude-remote') {
    return handleClaudeRemote(action, payload, res);
  } else {
    return handleTerragon(action, payload, res);
  }
}

async function handleClaudeRemote(action, payload, res) {
  const CLAUDE_REMOTE_URL = process.env.CLAUDE_REMOTE_URL || 'http://207.148.12.169:3000';
  
  try {
    switch (action) {
      case 'create-task': {
        // Create Claude-Remote session
        const sessionResponse = await fetch(`${CLAUDE_REMOTE_URL}/api/claude-remote-executor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-session',
            payload: {
              projectPath: '/workspace/unclefrank-bootstrap'
            }
          })
        });

        if (!sessionResponse.ok) {
          throw new Error('Failed to create Claude-Remote session');
        }

        const { sessionId } = await sessionResponse.json();

        // Extract task data
        const taskData = payload[0];
        const taskMessage = taskData.message.parts[0].text;

        // Send task to Claude-Remote
        const executeResponse = await fetch(`${CLAUDE_REMOTE_URL}/api/claude-remote-executor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execute-task',
            payload: {
              sessionId,
              task: {
                name: 'Task Execution',
                description: taskMessage,
                acceptanceCriteria: 'Complete all checkpoints successfully'
              },
              checkpoints: []
            }
          })
        });

        if (!executeResponse.ok) {
          throw new Error('Failed to execute task');
        }

        return res.status(200).json({
          success: true,
          threadId: sessionId,
          executor: 'claude-remote',
          url: `${CLAUDE_REMOTE_URL}/workspace/${sessionId}`
        });
      }

      case 'check-status':
      case 'check-terragon-status': {
        const { threadId } = payload;
        
        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/claude-remote-executor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check-status',
            payload: { sessionId: threadId }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to check status');
        }

        const status = await response.json();

        return res.status(200).json({
          threadId,
          status: status.status,
          completed: status.completed,
          messageCount: status.messageCount,
          lastActivity: status.lastActivity,
          url: status.workspaceUrl,
          executor: 'claude-remote'
        });
      }

      case 'export-changes': {
        const { threadId, format = 'git' } = payload;
        
        const response = await fetch(`${CLAUDE_REMOTE_URL}/api/claude-remote-executor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'export-workspace',
            payload: { sessionId: threadId, format }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to export changes');
        }

        const exportData = await response.text();

        return res.status(200).json({
          success: true,
          format,
          data: exportData,
          executor: 'claude-remote'
        });
      }

      default:
        // Fall back to Terragon for unsupported actions
        return handleTerragon(action, payload, res);
    }
  } catch (error) {
    console.error('[Claude-Remote] Error:', error);
    // Fall back to Terragon on error
    console.log('[Claude-Remote] Falling back to Terragon due to error');
    return handleTerragon(action, payload, res);
  }
}

async function handleTerragon(action, payload, res) {
  // Existing Terragon implementation
  // Copy the current execute.js implementation here
  
  // For brevity, returning a placeholder
  return res.status(200).json({
    message: 'Terragon executor - implement existing logic here',
    action,
    executor: 'terragon'
  });
}

// Helper function to determine which executor to use
export function selectExecutor(taskType, config = {}) {
  // Gradual rollout strategy
  const rolloutPercentage = parseInt(process.env.CLAUDE_REMOTE_ROLLOUT || '0');
  const random = Math.random() * 100;
  
  // Force Claude-Remote for specific task types
  const claudeRemoteOptimized = [
    'code-generation',
    'refactoring', 
    'test-creation',
    'documentation'
  ];
  
  if (claudeRemoteOptimized.includes(taskType)) {
    return 'claude-remote';
  }
  
  // Gradual rollout for other tasks
  if (random < rolloutPercentage) {
    return 'claude-remote';
  }
  
  // Default to Terragon
  return 'terragon';
}