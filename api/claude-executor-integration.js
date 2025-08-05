// FRANK'S GITHUB-INTEGRATED CLAUDE EXECUTOR INTEGRATION
// Full GitHub integration - real files, real commits, real code!

const CLAUDE_EXECUTOR_URL = process.env.CLAUDE_EXECUTOR_URL || 'https://uncle-frank-claude.fly.dev';
const CLAUDE_FALLBACK_MODE = process.env.CLAUDE_FALLBACK_MODE === 'true' || false;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-1-20250805'; // Latest Opus model

// Session manager to track Claude sessions by task
const sessionManager = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, payload } = req.body;

  try {
    switch (action) {
      case 'health-check': {
        // Check if Claude executor is running
        try {
          const healthResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          
          if (healthResponse.ok) {
            const health = await healthResponse.json();
            return res.status(200).json({
              success: true,
              status: 'online',
              executor: CLAUDE_EXECUTOR_URL,
              ...health
            });
          } else {
            throw new Error(`Health check failed: ${healthResponse.status}`);
          }
        } catch (error) {
          return res.status(503).json({
            success: false,
            status: 'offline',
            executor: CLAUDE_EXECUTOR_URL,
            error: `Claude executor at ${CLAUDE_EXECUTOR_URL} is not responding. The fly.io service appears to be down.`,
            solution: 'Please check if the Claude executor is deployed and running on fly.io'
          });
        }
      }
      
      case 'create-task': {
        // First check if Claude executor is available
        let executorHealthy = false;
        try {
          const healthCheck = await fetch(`${CLAUDE_EXECUTOR_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          });
          executorHealthy = healthCheck.ok;
        } catch (error) {
          console.error('[Claude Integration] Executor is offline:', error.message);
          executorHealthy = false;
        }
        
        // If not healthy, attempt auto-restart
        if (!executorHealthy) {
          console.log('[Claude Integration] Executor offline, attempting auto-restart...');
          
          try {
            // Check if we can auto-restart
            const flyResponse = await fetch(
              `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/flyio-manager`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check-health' })
              }
            );
            
            if (flyResponse.ok) {
              const flyStatus = await flyResponse.json();
              
              if (flyStatus.status === 'restarting') {
                return res.status(503).json({
                  success: false,
                  error: 'Claude executor is restarting',
                  details: 'The service was down and has been automatically restarted. Please try again in 30-60 seconds.',
                  retry: true,
                  retryAfter: 30
                });
              } else if (flyStatus.circuitBreaker === 'open') {
                return res.status(503).json({
                  success: false,
                  error: 'Claude executor restart failed multiple times',
                  details: flyStatus.message,
                  nextRetry: flyStatus.nextRetry
                });
              }
            }
          } catch (restartError) {
            console.error('[Claude Integration] Auto-restart failed:', restartError);
          }
          
          // If we get here, auto-restart wasn't possible
          return res.status(503).json({
            success: false,
            error: 'Claude executor service is not available',
            details: `The Claude executor at ${CLAUDE_EXECUTOR_URL} is not responding and could not be automatically restarted.`,
            executor: CLAUDE_EXECUTOR_URL
          });
        }
        
        // Extract task from request
        const taskData = Array.isArray(payload) ? payload[0] : payload;
        
        // Handle different message formats
        let taskMessage = '';
        if (typeof taskData.message === 'string') {
          taskMessage = taskData.message;
        } else if (taskData.message?.parts?.[0]?.text) {
          taskMessage = taskData.message.parts[0].text;
        } else if (taskData.message?.parts?.[0]?.nodes) {
          // Handle rich text format from UI
          const nodes = taskData.message.parts[0].nodes;
          taskMessage = nodes.map(node => node.text || '').join('');
        } else {
          taskMessage = JSON.stringify(taskData.message);
        }
        
        // Parse task to extract checkpoints
        const checkpoints = extractCheckpoints(taskMessage);
        
        // Create Claude session with GitHub repo using latest Opus model
        const sessionResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: `You are Uncle Frank's GitHub-integrated task executor.
            
CRITICAL INSTRUCTIONS:
1. You have full access to a cloned git repository
2. Create REAL files using standard commands (echo, cat, etc.)
3. Use git commands to track changes (git add, git status)
4. Execute REAL code - no placeholders, no "would" statements
5. Test everything - if it says "npm run build", actually run it
6. Report actual results, not hypothetical outcomes

Your job:
- Execute checkpoints in order
- Write REAL code in REAL files
- Test everything with REAL commands
- Report REAL results

Remember: Every checkpoint MUST have actual, testable outcomes. No BS.`,
            model: CLAUDE_MODEL,  // Use configured model
            modelCommand: `/model ${CLAUDE_MODEL}`  // Set model command first
          })
        });

        if (!sessionResponse.ok) {
          throw new Error(`Claude Executor error: ${sessionResponse.status}`);
        }

        const session = await sessionResponse.json();
        console.log(`[Claude Integration] Created GitHub session: ${session.sessionId}`);
        console.log(`[Claude Integration] Branch: ${session.branch}`);
        console.log(`[Claude Integration] Repo: ${session.repoPath}`);
        
        // Store session mapping
        sessionManager.set(session.sessionId, {
          taskData,
          checkpoints,
          created: new Date().toISOString(),
          status: 'created',
          branch: session.branch,
          githubUrl: session.githubUrl
        });

        // First set the model to latest Opus
        const setModelResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${session.sessionId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `/model ${CLAUDE_MODEL}`
          })
        });
        
        if (!setModelResponse.ok) {
          console.warn('[Claude Integration] Failed to set model, continuing anyway');
        }
        
        // Send task with explicit GitHub context
        const executeResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${session.sessionId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `# TASK EXECUTION REQUEST
Using model: ${CLAUDE_MODEL} (Latest Opus)

${taskMessage}

## CRITICAL CONTEXT:
- You are in a git repository at: ${session.repoPath}
- Current branch: ${session.branch}
- You have full file system access
- Use real commands: touch, echo, cat, npm, git, etc.
- Create real files, not descriptions

## Your Mission:
1. Execute each checkpoint in order
2. Create actual files with actual code
3. Run actual tests (npm install, npm run build, etc.)
4. Use git add to track new files
5. Report actual results

Start with Checkpoint 1 now. Create real files!`
          })
        });

        if (!executeResponse.ok) {
          throw new Error('Failed to send task to Claude');
        }

        const executeResult = await executeResponse.json();

        return res.status(200).json({
          success: true,
          threadId: session.sessionId,
          executor: 'claude-github',
          branch: session.branch,
          githubUrl: session.githubUrl,
          repoPath: session.repoPath,
          checkpoints: checkpoints.length,
          message: 'Task sent to GitHub-integrated Claude executor'
        });
      }

      case 'send-message': {
        // Handle checkpoint execution messages
        const { threadId, message } = payload;
        
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required' });
        }
        
        // Send message to Claude executor
        const executeResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        
        if (!executeResponse.ok) {
          throw new Error('Failed to send message to Claude');
        }
        
        const result = await executeResponse.json();
        
        return res.status(200).json({
          success: true,
          threadId: threadId,
          response: result.response,
          status: result.status
        });
      }

      case 'check-status':
      case 'check-claude-status':
      case 'check-terragon-status': {
        const { threadId } = payload;
        const sessionData = sessionManager.get(threadId);
        
        if (!sessionData) {
          return res.status(404).json({ error: 'Session not found' });
        }

        // Get session details from Claude
        const statusResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}`, {
          method: 'GET'
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to get status');
        }

        const session = await statusResponse.json();
        
        // Get messages to check progress
        const messagesResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/messages`);
        const { messages } = await messagesResponse.json();
        
        // Get files that were created/modified
        const filesResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/files`);
        const filesData = await filesResponse.json();
        
        // Analyze completion
        const lastMessage = messages[messages.length - 1];
        const completed = analyzeCompletion(lastMessage, sessionData.checkpoints);
        
        return res.status(200).json({
          threadId,
          status: session.status,
          completed,
          messageCount: messages.length,
          lastResponse: lastMessage?.content,
          checkpointsCompleted: countCompletedCheckpoints(messages),
          totalCheckpoints: sessionData.checkpoints.length,
          branch: session.branch,
          terragonBranch: session.branch, // UI compatibility
          claudeBranch: session.branch,
          gitStatus: session.gitStatus,
          filesCreated: filesData.files?.length || 0,
          modifiedFiles: filesData.modified || [],
          githubUrl: sessionData.githubUrl,
          allMessages: messages,
          executor: 'claude-github'
        });
      }

      case 'commit-changes': {
        const { threadId, message = 'Task completed by Claude' } = payload;
        
        // Commit and push changes
        const commitResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        
        if (!commitResponse.ok) {
          throw new Error('Failed to commit changes');
        }

        const commitResult = await commitResponse.json();
        
        return res.status(200).json({
          success: true,
          ...commitResult
        });
      }

      case 'get-files':
      case 'export-changes': {
        const { threadId } = payload;
        
        // Get files from Claude workspace
        const filesResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/files`);
        
        if (!filesResponse.ok) {
          throw new Error('Failed to get files');
        }

        const filesData = await filesResponse.json();
        
        return res.status(200).json({
          success: true,
          files: filesData.files || [],
          modified: filesData.modified || [],
          executor: 'claude-github'
        });
      }

      case 'create-pr': {
        const { threadId, title, body } = payload;
        const sessionData = sessionManager.get(threadId);
        
        if (!sessionData) {
          return res.status(404).json({ error: 'Session not found' });
        }

        // First commit any uncommitted changes
        await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: title })
        });

        // Create PR using GitHub CLI (this would be done on the Fly.io server)
        // For now, return the branch info so user can create PR manually
        return res.status(200).json({
          success: true,
          branch: sessionData.branch,
          githubUrl: sessionData.githubUrl,
          message: `Changes pushed to branch ${sessionData.branch}. Create PR at: ${sessionData.githubUrl}`
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[Claude GitHub Integration] Error:', error);
    return res.status(500).json({
      error: 'Claude execution error',
      details: error.message
    });
  }
}

// Helper functions (same as before)
function extractCheckpoints(taskMessage) {
  const checkpoints = [];
  const messageStr = typeof taskMessage === 'string' ? taskMessage : JSON.stringify(taskMessage);
  const lines = messageStr.split('\n');
  
  let inCheckpoint = false;
  let currentCheckpoint = null;
  
  for (const line of lines) {
    if (line.match(/^###?\s*Checkpoint\s*\d+/i)) {
      if (currentCheckpoint) {
        checkpoints.push(currentCheckpoint);
      }
      currentCheckpoint = {
        id: checkpoints.length + 1,
        name: line.replace(/^###?\s*/, '').trim(),
        objective: '',
        test: '',
        instructions: []
      };
      inCheckpoint = true;
    } else if (inCheckpoint && currentCheckpoint) {
      if (line.includes('Objective:')) {
        currentCheckpoint.objective = line.replace(/.*Objective:\s*/i, '').trim();
      } else if (line.includes('Test:')) {
        currentCheckpoint.test = line.replace(/.*Test:\s*/i, '').trim();
      } else if (line.trim() && !line.startsWith('#')) {
        currentCheckpoint.instructions.push(line.trim());
      }
    }
  }
  
  if (currentCheckpoint) {
    checkpoints.push(currentCheckpoint);
  }
  
  return checkpoints;
}

function analyzeCompletion(lastMessage, checkpoints) {
  if (!lastMessage) return false;
  
  const content = lastMessage.content.toLowerCase();
  
  // Check for explicit completion signals
  if (content.includes('all checkpoints completed') ||
      content.includes('all checkpoints are complete') ||
      content.includes('task completed successfully')) {
    return true;
  }
  
  // Check if all checkpoints are mentioned as complete
  let completedCount = 0;
  for (const checkpoint of checkpoints) {
    if (content.includes(`checkpoint ${checkpoint.id}`) && 
        (content.includes('complete') || content.includes('pass'))) {
      completedCount++;
    }
  }
  
  return completedCount === checkpoints.length;
}

function countCompletedCheckpoints(messages) {
  let completed = 0;
  const messageText = messages.map(m => m.content).join('\n').toLowerCase();
  
  // Count checkpoint completions
  const completionMatches = messageText.match(/checkpoint\s+\d+.*?(complete|pass|done)/gi) || [];
  return completionMatches.length;
}