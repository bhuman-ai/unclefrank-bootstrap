// TERRAGON INSTANCE MANAGER - Uncle Frank's Task Execution Orchestrator
// Manages Terragon instances that execute tasks autonomously

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);

const INSTANCES_DIR = '/Users/don/UncleFrank/unclefrank-bootstrap/data/terragon-instances';
const CHECKPOINTS_DIR = '/Users/don/UncleFrank/unclefrank-bootstrap/data/checkpoints';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'bhuman-ai/unclefrank-bootstrap';
const CLAUDE_EXECUTOR_URL = process.env.CLAUDE_EXECUTOR_URL || 'https://uncle-frank-claude.fly.dev';

// Instance states
const INSTANCE_STATES = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    ERRORED: 'errored',
    COMPLETED: 'completed',
    ESCALATED: 'escalated'
};

// Active instances in memory
const activeInstances = new Map();

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'spawn':
                return await spawnInstance(req, res);
            case 'status':
                return await getInstanceStatus(req, res);
            case 'pause':
                return await pauseInstance(req, res);
            case 'resume':
                return await resumeInstance(req, res);
            case 'escalate':
                return await escalateInstance(req, res);
            case 'rollback':
                return await rollbackInstance(req, res);
            case 'dashboard':
                return await getDashboard(req, res);
            case 'logs':
                return await getInstanceLogs(req, res);
            case 'heartbeat':
                return await updateHeartbeat(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Terragon Instance Manager error:', error);
        return res.status(500).json({ 
            error: 'Failed to process instance request',
            details: error.message 
        });
    }
}

// Spawn a new Terragon instance for a task
async function spawnInstance(req, res) {
    const { taskId, taskName, checkpoints } = req.body;
    
    if (!taskId || !taskName || !checkpoints) {
        return res.status(400).json({ 
            error: 'Missing required fields: taskId, taskName, checkpoints' 
        });
    }
    
    // Create instance ID
    const instanceId = `terragon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const instancePath = path.join(INSTANCES_DIR, instanceId);
    
    // Ensure directory exists
    await fs.mkdir(instancePath, { recursive: true });
    
    // Create Claude session for this instance
    let claudeSessionId = null;
    try {
        const sessionResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testOnly: false })
        });
        
        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            claudeSessionId = sessionData.sessionId;
        }
    } catch (error) {
        console.error('Failed to create Claude session:', error);
    }
    
    // Initialize instance data
    const instanceData = {
        id: instanceId,
        taskId,
        taskName,
        checkpoints,
        claudeSessionId,
        state: INSTANCE_STATES.ACTIVE,
        currentCheckpointIndex: 0,
        currentCheckpoint: checkpoints[0] || null,
        activeAgent: 'CheckpointAgent',
        completedCheckpoints: [],
        failedCheckpoints: [],
        logs: [],
        heartbeats: [],
        created: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        githubIssueNumber: null
    };
    
    // Save instance data
    await fs.writeFile(
        path.join(instancePath, 'instance.json'),
        JSON.stringify(instanceData, null, 2)
    );
    
    // Store in memory for real-time monitoring
    activeInstances.set(instanceId, instanceData);
    
    // Create GitHub issue for tracking
    try {
        const issue = await createGitHubIssue({
            title: `Terragon Instance: ${taskName}`,
            body: `## 🤖 Terragon Instance Active\n\n**Instance ID:** ${instanceId}\n**Task:** ${taskName} (${taskId})\n**Claude Session:** ${claudeSessionId || 'Not initialized'}\n\n### Checkpoints\n${checkpoints.map((cp, idx) => `${idx + 1}. [ ] ${cp.name}`).join('\n')}\n\n### Status\n**State:** ${instanceData.state}\n**Current Checkpoint:** ${instanceData.currentCheckpoint?.name || 'None'}\n**Active Agent:** ${instanceData.activeAgent}\n\n### Real-time Monitoring\nView live status in the Terragon Dashboard`,
            labels: ['terragon', 'task-execution', 'uncle-frank']
        });
        
        instanceData.githubIssueNumber = issue.number;
        await fs.writeFile(
            path.join(instancePath, 'instance.json'),
            JSON.stringify(instanceData, null, 2)
        );
    } catch (error) {
        console.error('Failed to create GitHub issue for Terragon instance:', error);
    }
    
    // Start executing the first checkpoint
    if (instanceData.currentCheckpoint && claudeSessionId) {
        executeCheckpointInBackground(instanceId, instanceData.currentCheckpoint, claudeSessionId);
    }
    
    return res.status(200).json({
        success: true,
        instanceId,
        state: INSTANCE_STATES.ACTIVE,
        claudeSession: claudeSessionId,
        githubIssue: instanceData.githubIssueNumber,
        message: `Terragon instance ${instanceId} spawned successfully`
    });
}

// Execute checkpoint in background
async function executeCheckpointInBackground(instanceId, checkpoint, sessionId) {
    const instance = activeInstances.get(instanceId);
    if (!instance) return;
    
    // Log execution start
    instance.logs.push({
        timestamp: new Date().toISOString(),
        type: 'checkpoint_start',
        message: `Starting checkpoint: ${checkpoint.name}`,
        checkpointId: checkpoint.id
    });
    
    try {
        // Send checkpoint to Claude for execution
        const executionPrompt = `Execute this checkpoint with Uncle Frank's no-BS approach:

Checkpoint: ${checkpoint.name}
Objective: ${checkpoint.objective}

Instructions:
${checkpoint.instructions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Pass/Fail Criteria (ALL must pass):
${checkpoint.passCriteria.map(c => `- ${c}`).join('\n')}

Execute each instruction precisely. Report back with:
1. What you did
2. Pass/Fail status for EACH criterion
3. Any issues encountered

Remember: Binary pass/fail only. No ambiguity.`;
        
        const response = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${sessionId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: executionPrompt })
        });
        
        if (response.ok) {
            // Poll for completion
            pollCheckpointExecution(instanceId, checkpoint.id, sessionId);
        } else {
            throw new Error('Failed to start checkpoint execution');
        }
        
    } catch (error) {
        instance.logs.push({
            timestamp: new Date().toISOString(),
            type: 'checkpoint_error',
            message: `Failed to execute checkpoint: ${error.message}`,
            checkpointId: checkpoint.id
        });
        
        instance.state = INSTANCE_STATES.ERRORED;
        await saveInstance(instanceId, instance);
    }
}

// Poll for checkpoint execution completion
async function pollCheckpointExecution(instanceId, checkpointId, sessionId) {
    const instance = activeInstances.get(instanceId);
    if (!instance) return;
    
    let attempts = 0;
    const maxAttempts = 360; // 30 minutes max (5 seconds * 360)
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            // Check Claude session status
            const response = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${sessionId}/status`);
            const status = await response.json();
            
            // Send heartbeat
            instance.heartbeats.push({
                timestamp: new Date().toISOString(),
                checkpointId,
                attempt: attempts,
                status: status.status
            });
            
            if (status.status === 'completed' || status.status === 'ready_for_review') {
                clearInterval(pollInterval);
                
                // Parse results to check pass/fail
                const lastResponse = status.lastResponse?.content || '';
                const passed = checkpointPassed(lastResponse, instance.currentCheckpoint.passCriteria);
                
                if (passed) {
                    instance.completedCheckpoints.push(checkpointId);
                    instance.logs.push({
                        timestamp: new Date().toISOString(),
                        type: 'checkpoint_passed',
                        message: `Checkpoint ${instance.currentCheckpoint.name} PASSED`,
                        checkpointId
                    });
                    
                    // Move to next checkpoint
                    instance.currentCheckpointIndex++;
                    if (instance.currentCheckpointIndex < instance.checkpoints.length) {
                        instance.currentCheckpoint = instance.checkpoints[instance.currentCheckpointIndex];
                        instance.activeAgent = 'CheckpointAgent';
                        executeCheckpointInBackground(instanceId, instance.currentCheckpoint, sessionId);
                    } else {
                        // All checkpoints complete
                        instance.state = INSTANCE_STATES.COMPLETED;
                        instance.activeAgent = 'TaskAgent';
                        instance.logs.push({
                            timestamp: new Date().toISOString(),
                            type: 'task_complete',
                            message: 'All checkpoints completed successfully'
                        });
                    }
                } else {
                    instance.failedCheckpoints.push(checkpointId);
                    instance.logs.push({
                        timestamp: new Date().toISOString(),
                        type: 'checkpoint_failed',
                        message: `Checkpoint ${instance.currentCheckpoint.name} FAILED`,
                        checkpointId
                    });
                    
                    // Handle retry or escalation
                    handleCheckpointFailure(instanceId, checkpointId);
                }
                
                await saveInstance(instanceId, instance);
                
            } else if (status.status === 'error' || status.status === 'timeout') {
                clearInterval(pollInterval);
                instance.state = INSTANCE_STATES.ERRORED;
                instance.logs.push({
                    timestamp: new Date().toISOString(),
                    type: 'execution_error',
                    message: `Checkpoint execution failed: ${status.error || 'Timeout'}`,
                    checkpointId
                });
                await saveInstance(instanceId, instance);
            }
            
            // Timeout after max attempts
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                instance.state = INSTANCE_STATES.ERRORED;
                instance.logs.push({
                    timestamp: new Date().toISOString(),
                    type: 'timeout',
                    message: 'Checkpoint execution timed out after 30 minutes',
                    checkpointId
                });
                await saveInstance(instanceId, instance);
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
        
        instance.lastActivity = new Date().toISOString();
        
    }, 5000); // Poll every 5 seconds
}

// Check if checkpoint passed based on criteria
function checkpointPassed(response, passCriteria) {
    if (!response || !passCriteria) return false;
    
    const responseLower = response.toLowerCase();
    
    // Look for explicit pass/fail indicators
    if (responseLower.includes('all criteria passed') || 
        responseLower.includes('all tests passed') ||
        responseLower.includes('checkpoint complete')) {
        return true;
    }
    
    if (responseLower.includes('failed') || 
        responseLower.includes('error') ||
        responseLower.includes('not passed')) {
        return false;
    }
    
    // Check if each criterion is mentioned as passed
    let passedCount = 0;
    for (const criterion of passCriteria) {
        if (responseLower.includes(criterion.toLowerCase()) && 
            (responseLower.includes('✓') || responseLower.includes('passed') || responseLower.includes('complete'))) {
            passedCount++;
        }
    }
    
    return passedCount === passCriteria.length;
}

// Handle checkpoint failure
async function handleCheckpointFailure(instanceId, checkpointId) {
    const instance = activeInstances.get(instanceId);
    if (!instance) return;
    
    const checkpoint = instance.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) return;
    
    // Check retry count
    checkpoint.retryCount = (checkpoint.retryCount || 0) + 1;
    
    if (checkpoint.retryCount < 3) {
        // Retry checkpoint
        instance.logs.push({
            timestamp: new Date().toISOString(),
            type: 'retry',
            message: `Retrying checkpoint (attempt ${checkpoint.retryCount}/3)`,
            checkpointId
        });
        
        executeCheckpointInBackground(instanceId, checkpoint, instance.claudeSessionId);
    } else {
        // Escalate after max retries
        instance.state = INSTANCE_STATES.ESCALATED;
        instance.activeAgent = 'Task-LLM-Resolver';
        instance.logs.push({
            timestamp: new Date().toISOString(),
            type: 'escalation',
            message: 'Checkpoint failed after 3 retries. Escalating to Task-LLM-Resolver',
            checkpointId
        });
        
        // Update GitHub issue for human intervention
        if (instance.githubIssueNumber) {
            await updateGitHubIssue(instance.githubIssueNumber, {
                labels: ['terragon', 'task-execution', 'needs-human-review', 'escalated'],
                body: `## ⚠️ ESCALATION REQUIRED\n\n**Instance ID:** ${instanceId}\n**Failed Checkpoint:** ${checkpoint.name}\n**Retry Attempts:** 3/3\n\n### Action Required\nThis checkpoint has failed multiple times and requires human intervention.\n\n### Failure Logs\n${instance.logs.filter(l => l.checkpointId === checkpointId).map(l => `- ${l.timestamp}: ${l.message}`).join('\n')}`
            });
        }
    }
    
    await saveInstance(instanceId, instance);
}

// Get instance status
async function getInstanceStatus(req, res) {
    const { instanceId } = req.query;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId) || await loadInstance(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    const progress = instance.checkpoints.length > 0 ? 
        (instance.completedCheckpoints.length / instance.checkpoints.length) * 100 : 0;
    
    return res.status(200).json({
        id: instance.id,
        taskId: instance.taskId,
        taskName: instance.taskName,
        state: instance.state,
        currentCheckpoint: instance.currentCheckpoint,
        activeAgent: instance.activeAgent,
        progress: Math.round(progress),
        completedCheckpoints: instance.completedCheckpoints.length,
        totalCheckpoints: instance.checkpoints.length,
        failedCheckpoints: instance.failedCheckpoints.length,
        lastActivity: instance.lastActivity,
        claudeSession: instance.claudeSessionId,
        githubIssue: instance.githubIssueNumber
    });
}

// Get dashboard view of all instances
async function getDashboard(req, res) {
    const instances = [];
    
    // Get all active instances from memory
    for (const [id, instance] of activeInstances.entries()) {
        const progress = instance.checkpoints.length > 0 ? 
            (instance.completedCheckpoints.length / instance.checkpoints.length) * 100 : 0;
        
        instances.push({
            id: instance.id,
            taskName: instance.taskName,
            state: instance.state,
            currentCheckpoint: instance.currentCheckpoint?.name || 'None',
            activeAgent: instance.activeAgent,
            progress: Math.round(progress),
            health: getInstanceHealth(instance),
            lastActivity: instance.lastActivity,
            retryCount: instance.currentCheckpoint?.retryCount || 0,
            recentLogs: instance.logs.slice(-5)
        });
    }
    
    // Sort by last activity (most recent first)
    instances.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    return res.status(200).json({
        instances,
        total: instances.length,
        active: instances.filter(i => i.state === INSTANCE_STATES.ACTIVE).length,
        paused: instances.filter(i => i.state === INSTANCE_STATES.PAUSED).length,
        errored: instances.filter(i => i.state === INSTANCE_STATES.ERRORED).length,
        escalated: instances.filter(i => i.state === INSTANCE_STATES.ESCALATED).length,
        completed: instances.filter(i => i.state === INSTANCE_STATES.COMPLETED).length
    });
}

// Get instance logs
async function getInstanceLogs(req, res) {
    const { instanceId, limit = 50 } = req.query;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId) || await loadInstance(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    const logs = instance.logs.slice(-parseInt(limit));
    
    return res.status(200).json({
        instanceId,
        logs,
        total: instance.logs.length
    });
}

// Pause instance
async function pauseInstance(req, res) {
    const { instanceId } = req.body;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    instance.state = INSTANCE_STATES.PAUSED;
    instance.logs.push({
        timestamp: new Date().toISOString(),
        type: 'paused',
        message: 'Instance paused by user'
    });
    
    await saveInstance(instanceId, instance);
    
    return res.status(200).json({
        success: true,
        instanceId,
        state: INSTANCE_STATES.PAUSED,
        message: 'Instance paused successfully'
    });
}

// Resume instance
async function resumeInstance(req, res) {
    const { instanceId } = req.body;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    instance.state = INSTANCE_STATES.ACTIVE;
    instance.logs.push({
        timestamp: new Date().toISOString(),
        type: 'resumed',
        message: 'Instance resumed by user'
    });
    
    await saveInstance(instanceId, instance);
    
    // Resume checkpoint execution
    if (instance.currentCheckpoint && instance.claudeSessionId) {
        executeCheckpointInBackground(instanceId, instance.currentCheckpoint, instance.claudeSessionId);
    }
    
    return res.status(200).json({
        success: true,
        instanceId,
        state: INSTANCE_STATES.ACTIVE,
        message: 'Instance resumed successfully'
    });
}

// Escalate instance to human
async function escalateInstance(req, res) {
    const { instanceId, reason } = req.body;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    instance.state = INSTANCE_STATES.ESCALATED;
    instance.logs.push({
        timestamp: new Date().toISOString(),
        type: 'escalated',
        message: `Instance escalated to human: ${reason || 'Manual escalation'}`
    });
    
    await saveInstance(instanceId, instance);
    
    // Update GitHub issue
    if (instance.githubIssueNumber) {
        await updateGitHubIssue(instance.githubIssueNumber, {
            labels: ['terragon', 'needs-human-review', 'escalated'],
            body: `## ⚠️ HUMAN INTERVENTION REQUIRED\n\n**Reason:** ${reason || 'Manual escalation'}\n**Instance ID:** ${instanceId}\n**Current Checkpoint:** ${instance.currentCheckpoint?.name || 'None'}\n\nPlease review the logs and take appropriate action.`
        });
    }
    
    return res.status(200).json({
        success: true,
        instanceId,
        state: INSTANCE_STATES.ESCALATED,
        message: 'Instance escalated to human review'
    });
}

// Rollback instance to previous checkpoint
async function rollbackInstance(req, res) {
    const { instanceId } = req.body;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    if (instance.currentCheckpointIndex > 0) {
        instance.currentCheckpointIndex--;
        instance.currentCheckpoint = instance.checkpoints[instance.currentCheckpointIndex];
        instance.state = INSTANCE_STATES.ACTIVE;
        instance.logs.push({
            timestamp: new Date().toISOString(),
            type: 'rollback',
            message: `Rolled back to checkpoint: ${instance.currentCheckpoint.name}`
        });
        
        await saveInstance(instanceId, instance);
        
        // Restart checkpoint execution
        if (instance.claudeSessionId) {
            executeCheckpointInBackground(instanceId, instance.currentCheckpoint, instance.claudeSessionId);
        }
        
        return res.status(200).json({
            success: true,
            instanceId,
            currentCheckpoint: instance.currentCheckpoint.name,
            message: 'Instance rolled back successfully'
        });
    } else {
        return res.status(400).json({
            error: 'Cannot rollback - already at first checkpoint'
        });
    }
}

// Update heartbeat
async function updateHeartbeat(req, res) {
    const { instanceId, checkpointId, status, message } = req.body;
    
    if (!instanceId) {
        return res.status(400).json({ error: 'Missing instanceId' });
    }
    
    const instance = activeInstances.get(instanceId);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    instance.heartbeats.push({
        timestamp: new Date().toISOString(),
        checkpointId,
        status,
        message
    });
    
    instance.lastActivity = new Date().toISOString();
    
    // Keep only last 100 heartbeats
    if (instance.heartbeats.length > 100) {
        instance.heartbeats = instance.heartbeats.slice(-100);
    }
    
    return res.status(200).json({
        success: true,
        instanceId,
        message: 'Heartbeat recorded'
    });
}

// Helper: Get instance health status
function getInstanceHealth(instance) {
    const now = new Date();
    const lastActivity = new Date(instance.lastActivity);
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
    
    if (instance.state === INSTANCE_STATES.ERRORED) return 'errored';
    if (instance.state === INSTANCE_STATES.ESCALATED) return 'escalated';
    if (instance.state === INSTANCE_STATES.COMPLETED) return 'completed';
    if (instance.state === INSTANCE_STATES.PAUSED) return 'paused';
    
    if (minutesSinceActivity < 5) return 'healthy';
    if (minutesSinceActivity < 15) return 'slow';
    return 'stalled';
}

// Helper: Save instance to disk
async function saveInstance(instanceId, instance) {
    const instancePath = path.join(INSTANCES_DIR, instanceId);
    await fs.mkdir(instancePath, { recursive: true });
    await fs.writeFile(
        path.join(instancePath, 'instance.json'),
        JSON.stringify(instance, null, 2)
    );
}

// Helper: Load instance from disk
async function loadInstance(instanceId) {
    try {
        const instancePath = path.join(INSTANCES_DIR, instanceId, 'instance.json');
        const data = await fs.readFile(instancePath, 'utf8');
        const instance = JSON.parse(data);
        activeInstances.set(instanceId, instance);
        return instance;
    } catch (error) {
        return null;
    }
}

// Helper: Create GitHub issue
async function createGitHubIssue({ title, body, labels }) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ title, body, labels });
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/issues`,
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Terragon-Instance-Manager',
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const issue = JSON.parse(responseData);
                    if (res.statusCode === 201) {
                        resolve(issue);
                    } else {
                        reject(new Error(`GitHub API error: ${issue.message}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Helper: Update GitHub issue
async function updateGitHubIssue(issueNumber, updates) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(updates);
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/issues/${issueNumber}`,
            method: 'PATCH',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Terragon-Instance-Manager',
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(responseData));
                } else {
                    reject(new Error(`Failed to update issue: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}