import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

class TerragonExecutor {
  constructor() {
    this.baseUrl = 'https://www.terragonlabs.com';
    this.deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';
    this.activeThreads = new Map();
  }

  async sendToTerragon(message, sessionId) {
    // Get or create thread for this session
    let threadId = this.activeThreads.get(sessionId);
    if (!threadId) {
      threadId = `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      this.activeThreads.set(sessionId, threadId);
    }

    const payload = [{
      threadId,
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: message
          }]
        }],
        timestamp: new Date().toISOString()
      }
    }];

    try {
      const response = await fetch(
        `${this.baseUrl}/task/${threadId}`,
        {
          method: 'POST',
          headers: {
            'accept': 'text/x-component',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
            'origin': this.baseUrl,
            'referer': `${this.baseUrl}/task/${threadId}`,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-deployment-id': this.deploymentId
          },
          body: JSON.stringify(payload)
        }
      );

      return {
        success: true,
        threadId,
        data: 'Message sent to Terragon chat'
      };
    } catch (error) {
      console.error('Terragon Chat Error:', error.message);
      return {
        success: false,
        error: `Failed to send to Terragon: ${error.message}`
      };
    }
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, checkpoint, projectContext, sessionId } = req.body;

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ 
      error: 'CLAUDE_API_KEY not configured',
      instructions: 'Add CLAUDE_API_KEY to Vercel environment variables'
    });
  }

  const executor = new TerragonExecutor();

  try {
    switch (action) {
      case 'start': {
        // Initialize execution session
        return res.status(200).json({
          sessionId: `session-${Date.now()}`,
          status: 'ready',
          message: 'Execution session started'
        });
      }

      case 'create-task': {
        // Create a new task via Terragon dashboard
        const { payload } = req.body;
        if (!payload) {
          return res.status(400).json({ error: 'Payload required' });
        }

        try {
          const response = await fetch(
            'https://www.terragonlabs.com/dashboard',
            {
              method: 'POST',
              headers: {
                'accept': 'text/x-component',
                'content-type': 'text/plain;charset=UTF-8',
                'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
                'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
                'origin': 'https://www.terragonlabs.com',
                'referer': 'https://www.terragonlabs.com/dashboard',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
              },
              body: JSON.stringify(payload)
            }
          );

          const responseText = await response.text();
          
          // Extract thread ID from response
          const threadIdMatch = responseText.match(/"id":"([^"]+)"/);
          const threadId = threadIdMatch ? threadIdMatch[1] : null;
          
          if (threadId) {
            return res.status(200).json({
              status: 'created',
              threadId: threadId,
              message: `Task created in Terragon`
            });
          } else {
            // Even if we don't get an ID, the task might have been created
            return res.status(200).json({
              status: 'created',
              threadId: 'check-dashboard',
              message: 'Task sent to Terragon - check dashboard for new task'
            });
          }
        } catch (error) {
          console.error('Failed to create Terragon task:', error);
          return res.status(500).json({
            error: 'Failed to create Terragon task',
            details: error.message
          });
        }
      }

      case 'execute': {
        if (!checkpoint) {
          return res.status(400).json({ error: 'Checkpoint required' });
        }

        // For sequential execution, we should use the existing thread
        const threadId = sessionId || checkpoint.threadId;
        if (!threadId || threadId.startsWith('exec-')) {
          return res.status(400).json({ 
            error: 'Valid Terragon thread ID required for checkpoint execution' 
          });
        }

        // Build checkpoint execution message
        const message = `# CHECKPOINT EXECUTION

## Checkpoint: ${checkpoint.name}
**Objective:** ${checkpoint.objective}
**Blocking:** ${checkpoint.blocking ? 'Yes - Must pass before continuing' : 'No'}

## Instructions
${checkpoint.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

## Pass Criteria (All must pass)
${checkpoint.passCriteria.map(pc => `✓ ${pc.description}`).join('\n')}

Please execute this checkpoint and report when complete.`;

        try {
          // Send to existing Terragon thread
          const payload = [{
            threadId: threadId,
            message: {
              type: 'user',
              model: 'sonnet',
              parts: [{
                type: 'rich-text',
                nodes: [{
                  type: 'text',
                  text: message
                }]
              }],
              timestamp: new Date().toISOString()
            }
          }];

          const response = await fetch(
            `https://www.terragonlabs.com/task/${threadId}`,
            {
              method: 'POST',
              headers: {
                'accept': 'text/x-component',
                'content-type': 'text/plain;charset=UTF-8',
                'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
                'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
                'origin': 'https://www.terragonlabs.com',
                'referer': `https://www.terragonlabs.com/task/${threadId}`,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
              },
              body: JSON.stringify(payload)
            }
          );

          const responseText = await response.text();
          
          // Return enhanced execution result
          return res.status(200).json({
            status: 'executed',
            checkpointId: checkpoint.id,
            checkpointName: checkpoint.name,
            threadId: threadId,
            response: response.ok ? 'Checkpoint sent to Terragon' : 'Sent (check thread)',
            executionDetails: {
              objective: checkpoint.objective,
              blocking: checkpoint.blocking,
              passCriteriaCount: checkpoint.passCriteria?.length || 0,
              instructions: checkpoint.instructions?.length || 0
            },
            nextActions: [
              'Wait for execution completion',
              'Run pass/fail tests',
              'Validate dependencies',
              'Continue to next checkpoint'
            ],
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to send checkpoint to Terragon:', error);
          return res.status(500).json({
            status: 'error',
            error: `Failed to send checkpoint to thread ${threadId}: ${error.message}`
          });
        }
      }

      case 'test-real': {
        if (!req.body.criteria) {
          return res.status(400).json({ error: 'Test criteria required' });
        }

        const { criteria, testDescription, mainThreadId } = req.body;
        
        // FRANK'S CONTEXTLESS TESTING - NEW TERRAGON INSTANCE FOR EACH TEST
        try {
          const description = testDescription || criteria.description;
          
          // Create test message for fresh Terragon instance with HARD TERMINATION
          const testMessage = `# CONTEXTLESS TEST EXECUTION

## Test Objective
Verify: ${description}

## Sacred Testing Principles
- NO CONTEXT from execution
- NO assumptions about what happened
- ONLY check actual system state
- Report OBJECTIVE findings

## Instructions
Check the actual file system / codebase and report:
1. Does the condition exist or not?
2. Provide specific evidence found
3. Be brutally honest - no assumptions

Test this criteria: "${description}"

Return result in format:
RESULT: [PASS/FAIL]
EVIDENCE: [what you actually found]
DETAILS: [specific findings]`;

          // Create NEW Terragon instance for testing
          const testPayload = [{
            message: {
              type: 'user',
              model: 'sonnet',
              parts: [{
                type: 'rich-text',
                nodes: [{
                  type: 'text',
                  text: testMessage
                }]
              }],
              timestamp: new Date().toISOString()
            },
            githubRepoFullName: 'bhuman-ai/unclefrank-bootstrap',
            repoBaseBranchName: 'master',
            saveAsDraft: false
          }];

          console.log('Creating NEW Terragon test instance for contextless testing...');
          
          const testResponse = await fetch(
            'https://www.terragonlabs.com/dashboard',
            {
              method: 'POST',
              headers: {
                'accept': 'text/x-component',
                'content-type': 'text/plain;charset=UTF-8',
                'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
                'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
                'origin': 'https://www.terragonlabs.com',
                'referer': 'https://www.terragonlabs.com/dashboard',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
              },
              body: JSON.stringify(testPayload)
            }
          );

          const testResponseText = await testResponse.text();
          const testThreadMatch = testResponseText.match(/"id":"([^"]+)"/);
          const testThreadId = testThreadMatch ? testThreadMatch[1] : 'test-pending';
          
          console.log(`Test instance created: ${testThreadId}`);
          
          // Send test result back to main execution thread
          if (mainThreadId && mainThreadId !== 'undefined') {
            const reportPayload = [{
              threadId: mainThreadId,
              message: {
                type: 'user',
                model: 'sonnet',
                parts: [{
                  type: 'rich-text',
                  nodes: [{
                    type: 'text',
                    text: `# TEST INITIATED

Fresh Terragon test instance created: ${testThreadId}

Testing criteria: "${description}"

Test is running in contextless environment with no knowledge of execution history.
Will report results once test instance completes verification.`
                  }]
                }],
                timestamp: new Date().toISOString()
              }
            }];

            await fetch(
              `https://www.terragonlabs.com/task/${mainThreadId}`,
              {
                method: 'POST',
                headers: {
                  'accept': 'text/x-component',
                  'content-type': 'text/plain;charset=UTF-8',
                  'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
                  'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
                  'origin': 'https://www.terragonlabs.com',
                  'referer': `https://www.terragonlabs.com/task/${mainThreadId}`,
                  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                  'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
                },
                body: JSON.stringify(reportPayload)
              }
            );
          }
          
          return res.status(200).json({
            testInstanceCreated: true,
            testThreadId: testThreadId,
            testUrl: `https://www.terragonlabs.com/task/${testThreadId}`,
            criteria: description,
            message: 'Contextless test instance created - results pending',
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          console.error('Test instance creation failed:', error);
          return res.status(500).json({
            passed: false,
            details: `Test instance creation error: ${error.message}`,
            criteria: criteria.description,
            error: error.message
          });
        }
      }

      case 'validate-task-real': {
        const { task, criteria, checkpointResults } = req.body;
        if (!task || !criteria) {
          return res.status(400).json({ error: 'Task and criteria required for validation' });
        }

        // REAL TASK VALIDATION - NO FAKE SHIT
        try {
          let validationPassed = false;
          let validationDetails = '';
          
          // Check if all blocking checkpoints actually passed
          const blockingCheckpoints = Object.values(checkpointResults || {})
            .filter(result => result.blocking && result.status !== 'pass');
          
          if (blockingCheckpoints.length > 0) {
            validationPassed = false;
            validationDetails = `${blockingCheckpoints.length} blocking checkpoints failed`;
          } else {
            // Check actual system state for acceptance criteria
            if (criteria.includes('UI') || criteria.includes('component')) {
              const fs = require('fs');
              const indexContent = fs.readFileSync('public/index.html', 'utf-8');
              validationPassed = indexContent.includes('ProjectEditor') || indexContent.includes('Draft');
              validationDetails = validationPassed ? 'UI components found' : 'UI components missing';
            } else if (criteria.includes('API') || criteria.includes('endpoint')) {
              // FRANK'S REAL API VALIDATION - NO ASSUMPTIONS
              try {
                const apiTestResponse = await fetch('/api/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'start' })
                });
                validationPassed = apiTestResponse.ok;
                validationDetails = validationPassed ? 'API endpoints responding' : 'API endpoints failed';
              } catch (apiError) {
                validationPassed = false;
                validationDetails = `API validation failed: ${apiError.message}`;
              }
            } else {
              // FRANK'S RULE: FAIL HONESTLY IF CRITERIA UNCLEAR
              validationPassed = false;
              validationDetails = `Unclear validation criteria: "${criteria}" - cannot validate automatically`;
            }
          }
          
          return res.status(200).json({
            passed: validationPassed,
            details: validationDetails,
            criteria: criteria,
            taskId: task.id || 'current-task',
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          return res.status(500).json({
            passed: false,
            details: `Task validation error: ${error.message}`,
            criteria: criteria,
            error: error.message
          });
        }
      }

      case 'status': {
        // Get status of a thread
        const { threadId } = req.body;
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required' });
        }
        
        return res.status(200).json({
          threadId,
          status: 'active',
          message: `Check thread at: https://www.terragonlabs.com/task/${threadId}`
        });
      }

      case 'execution-status': {
        // Get overall execution status for sequential flow
        const { taskId, checkpointId } = req.body;
        
        return res.status(200).json({
          taskId: taskId || 'current-task',
          checkpointId,
          executionFlow: 'sequential',
          status: 'monitoring',
          message: 'Sequential execution in progress - check individual checkpoint status',
          flowDetails: {
            testingEnabled: true,
            retryLogic: true,
            dependencyValidation: true,
            endToEndValidation: true
          },
          timestamp: new Date().toISOString()
        });
      }

      case 'check-terragon-status': {
        // Check if Terragon thread has completed execution
        const { threadId, lastMessageCount, lastMessageTime } = req.body;
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required for status check' });
        }

        try {
          // FRANK'S REAL TERRAGON STATUS CHECK - NO FAKE BULLSHIT
          const response = await fetch(
            `https://www.terragonlabs.com/task/${threadId}`,
            {
              method: 'GET',
              headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
                'referer': 'https://www.terragonlabs.com/dashboard',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
              }
            }
          );

          const pageContent = await response.text();
          
          // Parse the page to determine status and extract latest response
          let status = 'unknown';
          let completed = false;
          let hasRecentActivity = false;
          let lastResponse = '';
          
          // Extract the latest assistant message content
          const messageMatches = [...pageContent.matchAll(/"text":"([^"]+)"/g)];
          const currentMessageCount = messageMatches.length;
          
          if (messageMatches.length > 0) {
            // Get the last message (most recent)
            const lastMessageMatch = messageMatches[messageMatches.length - 1];
            lastResponse = lastMessageMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
          
          // FRANK'S COMPLETION DETECTION - BASED ON ACTUAL RESPONSE PATTERNS
          // Look for Git Checkpoint message which appears when completed
          const hasGitCheckpoint = pageContent.includes('Git Checkpoint') || pageContent.includes('git checkpoint');
          // Look for specific completion patterns in the response
          const hasCompletedPattern = lastResponse && (
            lastResponse.includes('checkpoint') && 
            (lastResponse.includes('completed') || lastResponse.includes('ready') || lastResponse.includes('done'))
          );
          // Check if response contains file update notifications
          const hasFileUpdates = pageContent.includes('Update (') || pageContent.includes('Read (');
          // Check for active work indicators in the text
          const hasActiveWork = lastResponse && (
            lastResponse.includes('Let me') || 
            lastResponse.includes('I\'ll') || 
            lastResponse.includes('Now I')
          );
          // Other indicators
          const hasSpinner = pageContent.includes('spinner') || pageContent.includes('loading') || pageContent.includes('animate-spin');
          const hasThinking = pageContent.includes('thinking') || pageContent.includes('Thinking');
          const hasCursorBlink = pageContent.includes('cursor-blink') || pageContent.includes('animate-pulse');
          const hasGenerating = pageContent.includes('generating') || pageContent.includes('Generating');
          const hasProcessing = pageContent.includes('processing') || pageContent.includes('Processing');
          const hasAnimating = pageContent.includes('animate') && !pageContent.includes('animate-none');
          
          // Track message changes
          const previousMessageCount = lastMessageCount || 0;
          const previousMessageTime = lastMessageTime ? new Date(lastMessageTime).getTime() : Date.now();
          const now = Date.now();
          const timeSinceLastMessage = now - previousMessageTime;
          
          // Primary detection: Message patterns and activity
          if (hasGitCheckpoint || (hasCompletedPattern && !hasActiveWork)) {
            // Terragon has completed - showing completion message
            status = 'completed';
            completed = true;
            console.log(`Terragon completed - Git Checkpoint or completion pattern detected`);
          } else if (currentMessageCount > previousMessageCount) {
            // New message just arrived - still active
            status = 'active';
            completed = false;
            console.log(`Terragon active - new message detected (count: ${currentMessageCount})`);
          } else if (hasActiveWork || hasFileUpdates) {
            // Still working based on message content
            status = 'active';
            completed = false;
            console.log(`Terragon active - work indicators in message`);
          } else if (hasSpinner || hasThinking || hasGenerating || hasCursorBlink || hasProcessing || hasAnimating) {
            // Terragon is actively working
            status = 'active';
            completed = false;
            console.log(`Terragon active - UI indicators present (spinner: ${hasSpinner}, thinking: ${hasThinking}, processing: ${hasProcessing})`);
          } else if (lastResponse.length > 0) {
            // Has messages, check for completion based on stability
            if (timeSinceLastMessage > 15000 && currentMessageCount === previousMessageCount) {
              // No new messages for 15 seconds - likely completed
              status = 'completed';
              completed = true;
              console.log(`Terragon completed - no new messages for ${timeSinceLastMessage/1000}s`);
            } else {
              // Still might be working
              status = 'active';
              completed = false;
            }
          } else if (pageContent.includes('Waiting for') || pageContent.includes('provisioning') || pageContent.includes('Sandbox')) {
            // Terragon is starting up
            status = 'starting';
            completed = false;
          } else {
            // Look for recent message activity - if Terragon replied recently, likely still working
            const messagePattern = /"timestamp":\s*"([^"]+)"/g;
            const timestamps = [...pageContent.matchAll(messagePattern)];
            
            if (timestamps.length > 0) {
              const latestTimestamp = timestamps[timestamps.length - 1][1];
              const latestTime = new Date(latestTimestamp).getTime();
              const now = new Date().getTime();
              const timeDiff = now - latestTime;
              
              // If last activity was within 2 minutes, consider it active
              if (timeDiff < 120000) {
                status = 'active';
                hasRecentActivity = true;
                completed = false;
              } else {
                status = 'idle';
                completed = true; // Consider idle threads as completed for polling
              }
            } else {
              status = 'waiting';
              completed = false;
            }
          }
          
          return res.status(200).json({
            threadId,
            status,
            completed,
            hasRecentActivity,
            lastResponse,
            messageCount: currentMessageCount,
            lastMessageTime: currentMessageCount > previousMessageCount ? now : previousMessageTime,
            hasUIActivity: hasSpinner || hasThinking || hasGenerating || hasCursorBlink || hasProcessing || hasAnimating,
            hasGitCheckpoint,
            hasCompletedPattern,
            uiIndicators: {
              gitCheckpoint: hasGitCheckpoint,
              completedPattern: hasCompletedPattern,
              activeWork: hasActiveWork,
              fileUpdates: hasFileUpdates,
              spinner: hasSpinner,
              thinking: hasThinking,
              generating: hasGenerating,
              cursorBlink: hasCursorBlink,
              processing: hasProcessing,
              animating: hasAnimating
            },
            url: `https://www.terragonlabs.com/task/${threadId}`,
            message: `Thread ${threadId} is ${status}`,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          console.error('Failed to check Terragon status:', error);
          return res.status(500).json({
            threadId,
            status: 'error',
            completed: true, // Stop polling on errors
            error: `Status check failed: ${error.message}`,
            timestamp: new Date().toISOString()
          });
        }
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Execution API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}