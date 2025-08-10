// FRANK'S GITHUB-INTEGRATED CLAUDE EXECUTOR INTEGRATION
// Full GitHub integration - real files, real commits, real code!

const CLAUDE_EXECUTOR_URL = process.env.CLAUDE_EXECUTOR_URL || 'https://uncle-frank-claude.fly.dev';
const CLAUDE_FALLBACK_MODE = process.env.CLAUDE_FALLBACK_MODE === 'true' || false;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-1-20250805'; // Latest Opus model
const GITHUB_REPO = process.env.GITHUB_REPO || 'bhuman-ai/unclefrank-bootstrap';

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

  // Handle GET requests with basic info
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Uncle Frank Claude Executor Integration',
      status: 'online',
      executor: CLAUDE_EXECUTOR_URL,
      github: GITHUB_REPO
    });
  }

  // Only handle POST requests for actions
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
              status: health.status === 'healthy' ? 'online' : health.status,
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
        const issueNumber = taskData.issueNumber; // Get issue number if provided
        
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
        
        // Create Claude session with GitHub repo and issue tracking
        let sessionResponse;
        let retryCount = 0;
        const maxRetries = 3;
        
        // Try to create session with retry logic
        while (retryCount < maxRetries) {
          try {
            sessionResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                repoUrl: `https://github.com/${GITHUB_REPO}`,
                taskTitle: `Task: ${taskMessage.substring(0, 100)}`,
                taskDescription: taskMessage
              })
            });
            
            if (sessionResponse.ok) {
              break; // Success
            }
            
            throw new Error(`Claude Executor error: ${sessionResponse.status}`);
          } catch (error) {
            retryCount++;
            console.error(`[Claude Integration] Attempt ${retryCount} failed:`, error.message);
            
            if (retryCount >= maxRetries) {
              // Use retry manager for advanced retry logic with exponential backoff
              console.log('[Claude Integration] Using retry manager for failed task');
              const retryResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/task-retry-manager`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'retry',
                  taskId: `session-create-${Date.now()}`,
                  taskFunction: 'claude-executor-session-create',
                  payload: {
                    repoUrl: `https://github.com/${GITHUB_REPO}`,
                    taskTitle: `Task: ${taskMessage.substring(0, 100)}`,
                    taskDescription: taskMessage
                  },
                  maxRetries: 5,
                  retryDelay: 2000
                })
              });
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json();
                if (retryResult.success && retryResult.result) {
                  // Retry manager succeeded - use the result
                  sessionResponse = { 
                    ok: true, 
                    json: async () => retryResult.result 
                  };
                  break; // Exit the retry loop
                }
              }
              
              throw new Error(`All retries exhausted. Claude Executor is unavailable.`);
              }
            }
            
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
        
        if (!sessionResponse || !sessionResponse.ok) {
          throw new Error(`Failed to create Claude session after ${maxRetries} attempts`);
        }

        const session = await sessionResponse.json();
        console.log(`[Claude Integration] Created GitHub session: ${session.sessionId}`);
        console.log(`[Claude Integration] Branch: ${session.branch}`);
        console.log(`[Claude Integration] Repo: ${session.repoPath}`);
        
        // Load essential context documents
        let claudeMdContent = '';
        let projectMdContent = '';
        let contextDocs = '';
        
        try {
          // ALWAYS include CLAUDE.md - the constitution
          console.log('[Claude Integration] Loading CLAUDE.md for context...');
          const claudeMdResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/storage-manager?action=get-doc&doc=claude`);
          if (claudeMdResponse.ok) {
            const claudeData = await claudeMdResponse.json();
            claudeMdContent = claudeData.content || '';
          }
          
          // Include current Project.md
          const projectResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/storage-manager?action=get-project`);
          if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            projectMdContent = projectData.content || '';
          }
          
          // Build context section
          contextDocs = `
# CRITICAL PROJECT CONTEXT

## CLAUDE.md - Development Constitution (MUST FOLLOW)
${claudeMdContent || '# Claude.md\n\nFollow Uncle Frank\'s no-BS approach. Draft → Validation → Task → Checkpoint → Review → Merge.'}

## Current Project.md State
${projectMdContent || '# Project.md\n\n[Current project state]'}

## Your Personality
You are part of Uncle Frank's team. Be direct, no-nonsense, focus on getting things done.
No corporate BS, no over-complication. If something is unclear, ask bluntly.
Think in micro-actions and realistic dependencies.

---
`;
        } catch (error) {
          console.error('[Claude Integration] Failed to load context docs:', error);
          contextDocs = `
# PROJECT CONTEXT
Follow Uncle Frank's doc-driven development approach.
Be direct, no-nonsense, get things done.
---
`;
        }
        
        // FRANK'S TWO-PHASE APPROACH
        // Phase 1: Get checkpoints from Claude WITHOUT executing
        console.log('[Claude Integration] Phase 1: Getting checkpoints from Claude WITH FULL CONTEXT...');
        
        const decomposeResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${session.sessionId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${contextDocs}

# CHECKPOINT DECOMPOSITION REQUEST

Working Directory: ${session.repoPath}
Task: ${taskMessage}

## CRITICAL FORMAT REQUIREMENTS:
Return ONLY the checkpoints in the exact format below.
Do NOT include any other text, explanations, or todo lists.
Do NOT execute anything - just decompose into checkpoints.

Start your response directly with "### Checkpoint 1:" (no preamble).

### Checkpoint 1: [Name]
- Objective: [one line objective]
- Deliverables: [deliverables on one line, semicolon separated if multiple]
- Pass Criteria: [criteria on one line, semicolon separated if multiple]

### Checkpoint 2: [Name]
- Objective: [one line objective]
- Deliverables: [deliverables on one line]
- Pass Criteria: [criteria on one line]

### Checkpoint 3: [Name]
- Objective: [one line objective]
- Deliverables: [deliverables on one line]
- Pass Criteria: [criteria on one line]

IMPORTANT RULES:
1. Start directly with "### Checkpoint 1:"
2. Keep each item on a single line
3. Use semicolons to separate multiple items within a line
4. Do not use sub-bullets or nested lists
5. Provide exactly 3-5 checkpoints
6. Do not include any other text before or after the checkpoints
7. Follow the principles in CLAUDE.md above`
          })
        });

        if (!decomposeResponse.ok) {
          throw new Error('Failed to get checkpoints from Claude');
        }

        const decomposeResult = await decomposeResponse.json();
        
        // Poll for completion since server is now async
        let checkpoints = [];
        let pollAttempts = 0;
        const maxPollAttempts = 30; // 60 seconds max
        
        while (pollAttempts < maxPollAttempts) {
          pollAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
          
          // Check status
          const statusResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${session.sessionId}/status`);
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'completed') {
              // Get the completed response
              if (statusData.lastResponse) {
                // Handle both formats: lastResponse.content and lastResponse as string
                const claudeResponse = typeof statusData.lastResponse === 'string' 
                  ? statusData.lastResponse 
                  : statusData.lastResponse.content;
                checkpoints = extractCheckpointsFromClaudeResponse(claudeResponse);
                console.log(`[Claude Integration] Extracted ${checkpoints.length} checkpoints after ${pollAttempts} polls`);
                break;
              }
            } else if (statusData.status === 'error') {
              console.error('[Claude Integration] Claude execution failed:', statusData.error);
              throw new Error('Claude execution failed: ' + (statusData.error || 'Unknown error'));
            }
            // If still processing, continue polling
          }
        }
        
        if (checkpoints.length === 0 && pollAttempts >= maxPollAttempts) {
          console.warn('[Claude Integration] Timeout waiting for Claude response');
        }
        
        // Store session mapping with checkpoints
        sessionManager.set(session.sessionId, {
          taskData,
          checkpoints,
          created: new Date().toISOString(),
          status: 'checkpoints_ready',
          branch: session.branch,
          githubUrl: session.githubUrl,
          issueNumber
        });
        
        // Return immediately with checkpoints
        return res.status(200).json({
          success: true,
          threadId: session.sessionId,
          executor: 'claude-github',
          branch: session.branch,
          githubUrl: session.githubUrl,
          repoPath: session.repoPath,
          checkpoints: checkpoints,
          checkpointCount: checkpoints.length,
          message: 'Checkpoints created. Ready to execute.',
          issueNumber
        });
      }

      case 'execute-checkpoints': {
        // Phase 2: Execute the checkpoints that were already created
        const { threadId } = payload;
        
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required' });
        }
        
        const sessionData = sessionManager.get(threadId);
        if (!sessionData) {
          return res.status(404).json({ error: 'Session not found' });
        }
        
        console.log(`[Claude Integration] Phase 2: Executing ${sessionData.checkpoints.length} checkpoints...`);
        
        // Filter out duplicate checkpoints and template placeholders
        const uniqueCheckpoints = sessionData.checkpoints
          .filter((cp, index, self) => 
            index === self.findIndex(c => c.id === cp.id) && // Remove duplicates by ID
            !cp.objective.includes('[Clear goal]') && // Remove template placeholders
            !cp.deliverables.includes('[What files/code to create]')
          );
        
        // Build message with actual checkpoint details
        let checkpointDetails = uniqueCheckpoints.map((cp, i) => 
          `### Checkpoint ${cp.id}: ${cp.name}
- Objective: ${cp.objective}
- Deliverables: ${cp.deliverables}
- Pass Criteria: ${cp.passCriteria}`
        ).join('\n\n');
        
        // Load context again for execution phase
        let executionContext = '';
        try {
          const claudeMdResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/storage-manager?action=get-doc&doc=claude`);
          if (claudeMdResponse.ok) {
            const claudeData = await claudeMdResponse.json();
            executionContext = `
# REMEMBER THE RULES (CLAUDE.md)
${claudeData.content || 'Follow Uncle Frank\'s approach. No BS.'}

---
`;
          }
        } catch (error) {
          console.error('[Claude Integration] Failed to reload context:', error);
        }
        
        // Send execution command to Claude (in the SAME session, so Claude remembers the task!)
        const executeResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${executionContext}
Now execute the checkpoints in ${sessionData.repoPath || '/app/sessions/' + threadId + '/repo'}:

${checkpointDetails}

## EXECUTION INSTRUCTIONS:
1. Execute each checkpoint in order, starting with Checkpoint 1
2. Create all files in the working directory: ${sessionData.repoPath || '/app/sessions/' + threadId + '/repo'}
3. After each checkpoint, run tests to verify it works
4. Report results for each checkpoint
5. Follow Uncle Frank's approach - no BS, just get it done
6. If something is unclear, state it bluntly and make a reasonable decision
7. Focus on working code over documentation`
          })
        });
        
        if (!executeResponse.ok) {
          throw new Error('Failed to start checkpoint execution');
        }
        
        // Update session status
        sessionData.status = 'executing';
        sessionManager.set(threadId, sessionData);
        
        return res.status(200).json({
          success: true,
          threadId,
          status: 'executing',
          message: `Executing ${sessionData.checkpoints.length} checkpoints`
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
        const sessionData = sessionManager.get(threadId) || {};
        
        try {
          // Get session details from Claude
          const statusResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}`, {
            method: 'GET'
          });

          if (!statusResponse.ok) {
            // Session might not exist on Claude executor
            return res.status(200).json({
              threadId,
              status: 'unknown',
              completed: false,
              messageCount: 0,
              allMessages: [],
              checkpointsCompleted: 0,
              totalCheckpoints: 0,
              error: 'Session not found on executor'
            });
          }

          const session = await statusResponse.json();
          
          // Get messages to check progress
          const messagesResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/messages`);
          let messages = [];
          
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            messages = messagesData.messages || [];
          }
        
          // Get files that were created/modified
          const filesResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${threadId}/files`);
          let filesData = {};
          
          if (filesResponse.ok) {
            filesData = await filesResponse.json();
          }
          
          // Analyze completion
          const lastMessage = messages[messages.length - 1];
          const completed = analyzeCompletion(lastMessage, sessionData.checkpoints || []);
          
          return res.status(200).json({
            threadId,
            status: session.status,
            completed,
            messageCount: messages.length,
            lastResponse: lastMessage?.content,
            checkpointsCompleted: countCompletedCheckpoints(messages),
            totalCheckpoints: sessionData.checkpoints?.length || 0,
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
        } catch (error) {
          console.error('[Claude Status Check] Error:', error);
          return res.status(200).json({
            threadId,
            status: 'error',
            completed: false,
            messageCount: 0,
            allMessages: [],
            error: error.message
          });
        }
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

// Helper functions
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

// Extract checkpoints from Claude's response format
function extractCheckpointsFromClaudeResponse(response) {
  const checkpoints = [];
  const lines = response.split('\n');
  
  let currentCheckpoint = null;
  let captureMode = null;
  
  for (const line of lines) {
    // Match checkpoint headers like "### Checkpoint 1: Name" or "Checkpoint 1: Name"
    const checkpointMatch = line.match(/^#{0,3}\s*Checkpoint\s*(\d+):\s*(.+)/i);
    if (checkpointMatch) {
      // Save previous checkpoint if exists
      if (currentCheckpoint) {
        checkpoints.push(currentCheckpoint);
      }
      
      currentCheckpoint = {
        id: parseInt(checkpointMatch[1]),
        name: checkpointMatch[2].trim(),
        objective: '',
        deliverables: '',
        passCriteria: '',
        raw: line
      };
      captureMode = null;
      continue;
    }
    
    // Capture checkpoint details
    if (currentCheckpoint) {
      if (line.match(/^\s*-\s*Objective:/i)) {
        currentCheckpoint.objective = line.replace(/^\s*-\s*Objective:\s*/i, '').trim();
        captureMode = 'objective';
      } else if (line.match(/^\s*-\s*Deliverables?:/i)) {
        currentCheckpoint.deliverables = line.replace(/^\s*-\s*Deliverables?:\s*/i, '').trim();
        captureMode = 'deliverables';
      } else if (line.match(/^\s*-\s*Pass\s*Criteria:/i)) {
        currentCheckpoint.passCriteria = line.replace(/^\s*-\s*Pass\s*Criteria:\s*/i, '').trim();
        captureMode = 'passCriteria';
      } else if (line.trim() && !line.startsWith('#') && captureMode) {
        // Continuation of previous field
        if (captureMode === 'objective' && !line.startsWith('-')) {
          currentCheckpoint.objective += ' ' + line.trim();
        } else if (captureMode === 'deliverables' && !line.startsWith('-')) {
          currentCheckpoint.deliverables += ' ' + line.trim();
        } else if (captureMode === 'passCriteria' && !line.startsWith('-')) {
          currentCheckpoint.passCriteria += ' ' + line.trim();
        }
      }
    }
  }
  
  // Don't forget the last checkpoint
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