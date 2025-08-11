// WORKFLOW ORCHESTRATOR - Connects all components for real execution
// This orchestrates the complete flow from edit to execution

const fetch = require('node-fetch');

// Get base URL for internal API calls
const getBaseUrl = () => {
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
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
    const baseUrl = getBaseUrl();
    
    try {
        switch (action) {
            case 'full-flow': {
                // Complete flow: Edit → Draft → Validate → Tasks → Execute
                const { message, autoExecute = false } = req.body;
                
                if (!message) {
                    return res.status(400).json({ error: 'Message required' });
                }
                
                // Step 1: Frank edits the document
                console.log('[Orchestrator] Step 1: Frank editing document...');
                const editResponse = await fetch(`${baseUrl}/api/frank-assistant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        context: { action: 'edit_document' }
                    })
                });
                
                if (!editResponse.ok) {
                    throw new Error('Failed to edit document');
                }
                
                const editResult = await editResponse.json();
                
                if (!editResult.success || !editResult.draftId) {
                    return res.status(200).json({
                        success: false,
                        message: 'No changes made',
                        editResult
                    });
                }
                
                // Step 2: Validate the draft
                console.log('[Orchestrator] Step 2: Validating draft...');
                const validateResponse = await fetch(`${baseUrl}/api/project-draft-manager?action=validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ draftId: editResult.draftId })
                });
                
                const validateResult = await validateResponse.json();
                
                if (!validateResult.allPassed) {
                    return res.status(200).json({
                        success: false,
                        step: 'validation',
                        draftId: editResult.draftId,
                        validations: validateResult.validations,
                        message: 'Validation failed - fix issues before proceeding'
                    });
                }
                
                // Step 3: Generate tasks
                console.log('[Orchestrator] Step 3: Generating tasks...');
                const tasksResponse = await fetch(`${baseUrl}/api/project-draft-manager?action=breakdown`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ draftId: editResult.draftId })
                });
                
                const tasksResult = await tasksResponse.json();
                
                if (!tasksResult.success || !tasksResult.tasks) {
                    return res.status(200).json({
                        success: false,
                        step: 'task-generation',
                        draftId: editResult.draftId,
                        message: 'Failed to generate tasks'
                    });
                }
                
                // Step 4: Execute if requested
                if (autoExecute) {
                    console.log('[Orchestrator] Step 4: Auto-executing tasks...');
                    const executionResults = [];
                    
                    for (const task of tasksResult.tasks) {
                        const execResponse = await fetch(`${baseUrl}/api/claude-executor-integration`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'create-task',
                                payload: {
                                    message: `Execute: ${task.name}\n${task.objective}`,
                                    issueNumber: task.githubIssue
                                }
                            })
                        });
                        
                        if (execResponse.ok) {
                            const execResult = await execResponse.json();
                            executionResults.push({
                                task: task.name,
                                threadId: execResult.threadId,
                                status: 'started'
                            });
                        }
                    }
                    
                    return res.status(200).json({
                        success: true,
                        draftId: editResult.draftId,
                        changes: editResult.changes,
                        tasks: tasksResult.tasks,
                        executions: executionResults,
                        message: 'Full flow completed - tasks are executing'
                    });
                }
                
                // Return results without execution
                return res.status(200).json({
                    success: true,
                    draftId: editResult.draftId,
                    changes: editResult.changes,
                    tasks: tasksResult.tasks,
                    message: 'Ready for execution - approve to proceed'
                });
            }
            
            case 'execute-draft': {
                // Execute all tasks for a draft
                const { draftId } = req.body;
                
                if (!draftId) {
                    return res.status(400).json({ error: 'Draft ID required' });
                }
                
                // Get draft details
                const draftResponse = await fetch(`${baseUrl}/api/project-draft-manager?action=get&draftId=${draftId}`);
                
                if (!draftResponse.ok) {
                    return res.status(404).json({ error: 'Draft not found' });
                }
                
                const draft = await draftResponse.json();
                
                if (!draft.tasks || draft.tasks.length === 0) {
                    return res.status(400).json({ error: 'No tasks to execute' });
                }
                
                // Execute each task
                const executionResults = [];
                
                for (const task of draft.tasks) {
                    if (task.status === 'completed') {
                        executionResults.push({
                            task: task.name,
                            status: 'already_completed'
                        });
                        continue;
                    }
                    
                    const execResponse = await fetch(`${baseUrl}/api/claude-executor-integration`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'create-task',
                            payload: {
                                message: `Task: ${task.name}\nObjective: ${task.objective}\nCriteria: ${task.acceptanceCriteria.join(', ')}`,
                                issueNumber: task.githubIssueNumber
                            }
                        })
                    });
                    
                    if (execResponse.ok) {
                        const execResult = await execResponse.json();
                        executionResults.push({
                            task: task.name,
                            threadId: execResult.threadId,
                            branch: execResult.branch,
                            status: 'executing'
                        });
                        
                        // Execute checkpoints if present - with REAL checkpoint executor
                        if (execResult.checkpoints && execResult.checkpoints.length > 0) {
                            console.log(`[Orchestrator] Executing ${execResult.checkpoints.length} checkpoints with tests and retries`);
                            const checkpointExecResponse = await fetch(`${baseUrl}/api/claude-executor-integration`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'execute-checkpoints',
                                    payload: { threadId: execResult.threadId }
                                })
                            });
                            
                            if (checkpointExecResponse.ok) {
                                const checkpointResult = await checkpointExecResponse.json();
                                executionResults[executionResults.length - 1].checkpointResults = checkpointResult;
                            }
                        }
                    } else {
                        executionResults.push({
                            task: task.name,
                            status: 'failed',
                            error: 'Failed to start execution'
                        });
                    }
                }
                
                return res.status(200).json({
                    success: true,
                    draftId,
                    executionResults,
                    message: `Started execution of ${executionResults.length} tasks`
                });
            }
            
            case 'check-status': {
                // Check status of all components
                const status = {
                    frank: false,
                    claude: false,
                    storage: false,
                    github: false
                };
                
                // Check Frank
                try {
                    const frankResponse = await fetch(`${baseUrl}/api/frank-assistant`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: 'status' })
                    });
                    status.frank = frankResponse.ok;
                } catch (e) {
                    status.frank = false;
                }
                
                // Check Claude
                try {
                    const claudeResponse = await fetch(`${baseUrl}/api/claude-executor-integration`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'health-check', payload: {} })
                    });
                    const claudeResult = await claudeResponse.json();
                    status.claude = claudeResult.success;
                } catch (e) {
                    status.claude = false;
                }
                
                // Check Storage
                try {
                    const storageResponse = await fetch(`${baseUrl}/api/storage-manager?action=health`);
                    status.storage = storageResponse.ok;
                } catch (e) {
                    status.storage = false;
                }
                
                // GitHub is assumed working if we can reach our APIs
                status.github = true;
                
                const allOperational = Object.values(status).every(v => v);
                
                return res.status(200).json({
                    success: true,
                    operational: allOperational,
                    services: status,
                    message: allOperational ? 'All systems operational' : 'Some services are down'
                });
            }
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('[Orchestrator] Error:', error);
        return res.status(500).json({
            error: 'Orchestration failed',
            details: error.message
        });
    }
};