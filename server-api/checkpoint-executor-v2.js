// CHECKPOINT EXECUTOR V2 - Uncle Frank's Micro-Execution Engine
// Executes checkpoints individually with binary pass/fail tests, retries, and escalation
// Following the immutable flow from CLAUDE.md

const fetch = require('node-fetch');

// Configuration from CLAUDE.md
const CHECKPOINT_RETRY_LIMIT = 3;        // Checkpoint retries before escalation
const TASK_RESOLVER_RETRY_LIMIT = 5;    // Task-LLM-Resolver retries
const TEST_TIMEOUT = 30000;             // 30 seconds for test execution
const RETRY_DELAY = 2000;               // 2 seconds between retries

// Get base URL for internal API calls
const getBaseUrl = () => {
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
};

// Checkpoint execution states
const CheckpointState = {
    PENDING: 'pending',
    EXECUTING: 'executing',
    TESTING: 'testing',
    PASSED: 'passed',
    FAILED: 'failed',
    RETRYING: 'retrying',
    ESCALATED: 'escalated',
    BLOCKED: 'blocked'
};

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'execute':
                return await executeCheckpoint(req, res);
            case 'execute-all':
                return await executeAllCheckpoints(req, res);
            case 'test':
                return await testCheckpoint(req, res);
            case 'status':
                return await getCheckpointStatus(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('[Checkpoint Executor] Error:', error);
        return res.status(500).json({
            error: 'Checkpoint execution failed',
            details: error.message
        });
    }
};

// Execute all checkpoints for a task with proper flow
async function executeAllCheckpoints(req, res) {
    const { sessionId, checkpoints, repoPath } = req.body;
    
    if (!sessionId || !checkpoints || checkpoints.length === 0) {
        return res.status(400).json({ 
            error: 'Missing sessionId or checkpoints',
            frank: 'Give me something to work with here.'
        });
    }
    
    console.log(`[Checkpoint Executor] Starting execution of ${checkpoints.length} checkpoints`);
    
    const executionLog = [];
    const results = {
        sessionId,
        totalCheckpoints: checkpoints.length,
        passed: 0,
        failed: 0,
        blocked: 0,
        log: executionLog,
        startTime: new Date().toISOString()
    };
    
    // Execute checkpoints in sequence (dependencies matter!)
    for (let i = 0; i < checkpoints.length; i++) {
        const checkpoint = checkpoints[i];
        const checkpointResult = {
            id: checkpoint.id,
            name: checkpoint.name,
            state: CheckpointState.PENDING,
            attempts: 0,
            testResults: [],
            startTime: new Date().toISOString()
        };
        
        console.log(`[Checkpoint ${checkpoint.id}] Starting: ${checkpoint.name}`);
        executionLog.push({
            timestamp: new Date().toISOString(),
            message: `Starting Checkpoint ${checkpoint.id}: ${checkpoint.name}`
        });
        
        // PHASE 1: Execute the checkpoint
        let executionSuccess = false;
        let retryCount = 0;
        
        while (!executionSuccess && retryCount < CHECKPOINT_RETRY_LIMIT) {
            retryCount++;
            checkpointResult.attempts = retryCount;
            checkpointResult.state = retryCount > 1 ? CheckpointState.RETRYING : CheckpointState.EXECUTING;
            
            console.log(`[Checkpoint ${checkpoint.id}] Execution attempt ${retryCount}/${CHECKPOINT_RETRY_LIMIT}`);
            
            try {
                // Execute via Claude
                const executeResponse = await fetch(`${getBaseUrl()}/api/claude-executor-integration`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send-message',
                        payload: {
                            threadId: sessionId,
                            message: `Execute Checkpoint ${checkpoint.id}: ${checkpoint.name}
                            
Objective: ${checkpoint.objective}
Deliverables: ${checkpoint.deliverables}
Working Directory: ${repoPath}

Execute this specific checkpoint NOW. Create the deliverables.
Report "CHECKPOINT_COMPLETE" when done.`
                        }
                    })
                });
                
                if (executeResponse.ok) {
                    const result = await executeResponse.json();
                    
                    // Wait for execution
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // PHASE 2: Test the checkpoint
                    checkpointResult.state = CheckpointState.TESTING;
                    console.log(`[Checkpoint ${checkpoint.id}] Testing pass criteria: ${checkpoint.passCriteria}`);
                    
                    const testResult = await runCheckpointTest(
                        sessionId,
                        checkpoint,
                        repoPath
                    );
                    
                    checkpointResult.testResults.push({
                        attempt: retryCount,
                        passed: testResult.passed,
                        message: testResult.message,
                        timestamp: new Date().toISOString()
                    });
                    
                    if (testResult.passed) {
                        executionSuccess = true;
                        checkpointResult.state = CheckpointState.PASSED;
                        results.passed++;
                        
                        console.log(`[Checkpoint ${checkpoint.id}] ✅ PASSED after ${retryCount} attempts`);
                        executionLog.push({
                            timestamp: new Date().toISOString(),
                            message: `✅ Checkpoint ${checkpoint.id} PASSED`,
                            attempts: retryCount
                        });
                    } else {
                        console.log(`[Checkpoint ${checkpoint.id}] ❌ Test failed: ${testResult.message}`);
                        
                        if (retryCount < CHECKPOINT_RETRY_LIMIT) {
                            // Wait before retry
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                        }
                    }
                } else {
                    throw new Error('Failed to execute checkpoint via Claude');
                }
                
            } catch (error) {
                console.error(`[Checkpoint ${checkpoint.id}] Execution error:`, error);
                checkpointResult.testResults.push({
                    attempt: retryCount,
                    passed: false,
                    message: `Execution error: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
                
                if (retryCount < CHECKPOINT_RETRY_LIMIT) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        
        // PHASE 3: Escalate if failed after retries
        if (!executionSuccess) {
            console.log(`[Checkpoint ${checkpoint.id}] Failed after ${CHECKPOINT_RETRY_LIMIT} attempts - ESCALATING`);
            checkpointResult.state = CheckpointState.ESCALATED;
            
            // Try Task-LLM-Resolver
            const escalationResult = await escalateToResolver(
                sessionId,
                checkpoint,
                checkpointResult.testResults
            );
            
            if (escalationResult.resolved) {
                checkpointResult.state = CheckpointState.PASSED;
                results.passed++;
                executionLog.push({
                    timestamp: new Date().toISOString(),
                    message: `✅ Checkpoint ${checkpoint.id} resolved by Task-LLM-Resolver`,
                    escalation: true
                });
            } else {
                // Final escalation to human
                checkpointResult.state = CheckpointState.BLOCKED;
                results.blocked++;
                results.failed++;
                
                executionLog.push({
                    timestamp: new Date().toISOString(),
                    message: `🚨 Checkpoint ${checkpoint.id} BLOCKED - Human intervention required`,
                    escalation: 'human',
                    failures: checkpointResult.testResults
                });
                
                // Stop execution - can't proceed with blocked checkpoint
                console.error(`[Checkpoint ${checkpoint.id}] BLOCKED - Stopping execution chain`);
                break;
            }
        }
        
        checkpointResult.endTime = new Date().toISOString();
        results.checkpoints = results.checkpoints || [];
        results.checkpoints.push(checkpointResult);
    }
    
    results.endTime = new Date().toISOString();
    results.success = results.failed === 0 && results.blocked === 0;
    
    return res.status(200).json(results);
}

// Run the binary pass/fail test for a checkpoint
async function runCheckpointTest(sessionId, checkpoint, repoPath) {
    console.log(`[Test Runner] Testing checkpoint ${checkpoint.id}`);
    
    try {
        // Send test command to Claude
        const testResponse = await fetch(`${getBaseUrl()}/api/claude-executor-integration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send-message',
                payload: {
                    threadId: sessionId,
                    message: `TEST CHECKPOINT ${checkpoint.id}

Pass Criteria: ${checkpoint.passCriteria}
Working Directory: ${repoPath}

Run tests to verify the pass criteria is met.
Check that deliverables exist and work correctly.

Respond with EXACTLY one of these:
- "TEST_PASS: [reason]" if all criteria are met
- "TEST_FAIL: [specific failure reason]" if any criteria are not met

Be strict - all criteria must be fully satisfied for a PASS.`
                }
            })
        });
        
        if (!testResponse.ok) {
            return {
                passed: false,
                message: 'Failed to communicate with Claude for testing'
            };
        }
        
        // Wait for Claude's response
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check the test result
        const statusResponse = await fetch(`${getBaseUrl()}/api/claude-executor-integration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'check-status',
                payload: { threadId: sessionId }
            })
        });
        
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            const lastResponse = status.lastResponse || '';
            
            // Parse test result from Claude's response
            if (lastResponse.includes('TEST_PASS')) {
                const reason = lastResponse.match(/TEST_PASS:\s*(.+)/)?.[1] || 'Criteria met';
                return {
                    passed: true,
                    message: reason
                };
            } else if (lastResponse.includes('TEST_FAIL')) {
                const reason = lastResponse.match(/TEST_FAIL:\s*(.+)/)?.[1] || 'Criteria not met';
                return {
                    passed: false,
                    message: reason
                };
            } else {
                // Default to fail if unclear
                return {
                    passed: false,
                    message: 'Test result unclear - defaulting to FAIL'
                };
            }
        }
        
        return {
            passed: false,
            message: 'Could not retrieve test results'
        };
        
    } catch (error) {
        console.error('[Test Runner] Error:', error);
        return {
            passed: false,
            message: `Test execution error: ${error.message}`
        };
    }
}

// Escalate to Task-LLM-Resolver
async function escalateToResolver(sessionId, checkpoint, previousAttempts) {
    console.log(`[Escalation] Escalating checkpoint ${checkpoint.id} to Task-LLM-Resolver`);
    
    let resolverAttempts = 0;
    let resolved = false;
    
    while (!resolved && resolverAttempts < TASK_RESOLVER_RETRY_LIMIT) {
        resolverAttempts++;
        console.log(`[Escalation] Resolver attempt ${resolverAttempts}/${TASK_RESOLVER_RETRY_LIMIT}`);
        
        try {
            // Ask Claude to analyze and fix the issue
            const resolveResponse = await fetch(`${getBaseUrl()}/api/claude-executor-integration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send-message',
                    payload: {
                        threadId: sessionId,
                        message: `TASK-LLM-RESOLVER: Fix Checkpoint ${checkpoint.id}

This checkpoint has failed ${previousAttempts.length} times.
Checkpoint: ${checkpoint.name}
Objective: ${checkpoint.objective}
Deliverables: ${checkpoint.deliverables}
Pass Criteria: ${checkpoint.passCriteria}

Previous failures:
${previousAttempts.map(a => `- Attempt ${a.attempt}: ${a.message}`).join('\n')}

ANALYZE the failures and FIX the issue.
Try a different approach if needed.
Ensure all pass criteria are met.

Report "RESOLVER_SUCCESS" when fixed.`
                    }
                })
            });
            
            if (resolveResponse.ok) {
                // Wait for resolution
                await new Promise(resolve => setTimeout(resolve, 8000));
                
                // Test again
                const testResult = await runCheckpointTest(sessionId, checkpoint, '');
                
                if (testResult.passed) {
                    resolved = true;
                    console.log(`[Escalation] ✅ Resolver fixed checkpoint ${checkpoint.id}`);
                    return {
                        resolved: true,
                        attempts: resolverAttempts,
                        message: 'Task-LLM-Resolver successfully fixed the issue'
                    };
                }
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * 2));
            
        } catch (error) {
            console.error('[Escalation] Resolver error:', error);
        }
    }
    
    console.log(`[Escalation] ❌ Resolver failed after ${TASK_RESOLVER_RETRY_LIMIT} attempts`);
    return {
        resolved: false,
        attempts: resolverAttempts,
        message: 'Task-LLM-Resolver could not fix the issue - human intervention required'
    };
}

// Execute a single checkpoint (for testing)
async function executeCheckpoint(req, res) {
    const { sessionId, checkpoint, repoPath } = req.body;
    
    if (!sessionId || !checkpoint) {
        return res.status(400).json({ error: 'Missing sessionId or checkpoint' });
    }
    
    // Execute single checkpoint using the full flow
    const result = await executeAllCheckpoints(
        { body: { sessionId, checkpoints: [checkpoint], repoPath } },
        { 
            status: () => ({ json: (data) => data }),
            setHeader: () => {}
        }
    );
    
    return res.status(200).json(result);
}

// Test a checkpoint without executing it
async function testCheckpoint(req, res) {
    const { sessionId, checkpoint, repoPath } = req.body;
    
    if (!sessionId || !checkpoint) {
        return res.status(400).json({ error: 'Missing sessionId or checkpoint' });
    }
    
    const testResult = await runCheckpointTest(sessionId, checkpoint, repoPath || '');
    
    return res.status(200).json({
        success: testResult.passed,
        ...testResult
    });
}

// Get checkpoint execution status
async function getCheckpointStatus(req, res) {
    const { sessionId } = req.query;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    // In production, this would retrieve from storage
    // For now, return current execution state
    return res.status(200).json({
        sessionId,
        status: 'Status tracking not yet implemented',
        message: 'Add storage integration for checkpoint status'
    });
}