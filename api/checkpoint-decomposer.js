// CHECKPOINT DECOMPOSER - Uncle Frank's Micro-Execution System
// Breaks down tasks into executable checkpoints with binary Pass/Fail tests

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import Anthropic from '@anthropic-ai/sdk';

const CHECKPOINTS_DIR = '/Users/don/UncleFrank/unclefrank-bootstrap/data/checkpoints';
const TASKS_DIR = '/Users/don/UncleFrank/unclefrank-bootstrap/data/tasks';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'bhuman-ai/unclefrank-bootstrap';

// Initialize Claude for intelligent decomposition
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
});

// Frank's checkpoint decomposition prompt
const FRANK_DECOMPOSITION_PROMPT = `You are Frank's checkpoint decomposer. Break down tasks into micro-executable steps with BINARY Pass/Fail tests.

Rules:
1. Each checkpoint must be a single, atomic action
2. Pass/Fail criteria must be binary - no ambiguity
3. Dependencies must be explicit
4. Parallel execution allowed only when no conflicts exist
5. Each checkpoint should take 5-30 minutes max
6. Be specific and technical - no fluff

Output format:
{
  "checkpoints": [
    {
      "name": "Clear, action-oriented name",
      "objective": "Specific micro-goal",
      "instructions": ["Step 1", "Step 2"],
      "passCriteria": ["Binary test 1", "Binary test 2"],
      "blocking": true/false,
      "parallelizable": true/false,
      "dependencies": ["checkpoint-id"],
      "estimatedMinutes": 15,
      "files": ["file1.js", "file2.ts"],
      "retryable": true
    }
  ]
}`;

export default async function handler(req, res) {
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
            case 'decompose':
                return await decomposeTask(req, res);
            case 'get':
                return await getCheckpoint(req, res);
            case 'execute':
                return await executeCheckpoint(req, res);
            case 'validate':
                return await validateCheckpoint(req, res);
            case 'status':
                return await getCheckpointStatus(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Checkpoint Decomposer error:', error);
        return res.status(500).json({ 
            error: 'Failed to process checkpoint request',
            details: error.message 
        });
    }
}

// Decompose a task into checkpoints
async function decomposeTask(req, res) {
    const { taskId, taskName, objective, acceptanceCriteria } = req.body;
    
    if (!taskId || !taskName || !objective) {
        return res.status(400).json({ 
            error: 'Missing required fields: taskId, taskName, objective' 
        });
    }
    
    // Ensure directories exist
    await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
    await fs.mkdir(TASKS_DIR, { recursive: true });
    
    let checkpoints = [];
    
    try {
        // Use Claude to intelligently decompose the task
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder-key') {
            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-latest',
                max_tokens: 2000,
                temperature: 0.3,
                system: FRANK_DECOMPOSITION_PROMPT,
                messages: [{
                    role: 'user',
                    content: `Break down this task into checkpoints:
                    
Task: ${taskName}
Objective: ${objective}
Acceptance Criteria: ${acceptanceCriteria ? acceptanceCriteria.join(', ') : 'None specified'}

Create 3-7 checkpoints that completely cover this task. Each must have clear pass/fail tests.`
                }]
            });
            
            try {
                const content = response.content[0].text;
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    checkpoints = parsed.checkpoints || [];
                }
            } catch (parseError) {
                console.error('Failed to parse Claude response:', parseError);
            }
        }
        
        // Fallback: Generate default checkpoints if Claude fails
        if (checkpoints.length === 0) {
            checkpoints = generateDefaultCheckpoints(taskName, objective, acceptanceCriteria);
        }
        
    } catch (error) {
        console.error('Claude decomposition failed:', error);
        checkpoints = generateDefaultCheckpoints(taskName, objective, acceptanceCriteria);
    }
    
    // Create checkpoint records
    const createdCheckpoints = [];
    for (const checkpoint of checkpoints) {
        const checkpointId = `cp-${taskId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const checkpointPath = path.join(CHECKPOINTS_DIR, checkpointId);
        
        await fs.mkdir(checkpointPath, { recursive: true });
        
        const checkpointData = {
            id: checkpointId,
            taskId,
            taskName,
            ...checkpoint,
            status: 'pending',
            retryAttempts: 0,
            maxRetries: 3,
            created: new Date().toISOString(),
            logs: [],
            githubIssueNumber: null
        };
        
        // Save checkpoint data
        await fs.writeFile(
            path.join(checkpointPath, 'checkpoint.json'),
            JSON.stringify(checkpointData, null, 2)
        );
        
        // Create GitHub issue for tracking
        try {
            const issue = await createGitHubIssue({
                title: `Checkpoint: ${checkpoint.name}`,
                body: `## 🎯 Checkpoint Details\n\n**Task:** ${taskName} (${taskId})\n**Checkpoint ID:** ${checkpointId}\n\n### Objective\n${checkpoint.objective}\n\n### Instructions\n${checkpoint.instructions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\n### Pass/Fail Criteria\n${checkpoint.passCriteria.map(c => `- [ ] ${c}`).join('\n')}\n\n### Properties\n- **Blocking:** ${checkpoint.blocking ? 'Yes' : 'No'}\n- **Parallelizable:** ${checkpoint.parallelizable ? 'Yes' : 'No'}\n- **Estimated Time:** ${checkpoint.estimatedMinutes} minutes\n- **Retryable:** ${checkpoint.retryable ? 'Yes' : 'No'}\n\n### Status\n**Current:** ${checkpointData.status}`,
                labels: ['checkpoint', 'task', 'uncle-frank']
            });
            
            checkpointData.githubIssueNumber = issue.number;
            await fs.writeFile(
                path.join(checkpointPath, 'checkpoint.json'),
                JSON.stringify(checkpointData, null, 2)
            );
        } catch (error) {
            console.error('Failed to create GitHub issue for checkpoint:', error);
        }
        
        createdCheckpoints.push({
            id: checkpointId,
            name: checkpoint.name,
            status: 'pending',
            githubIssue: checkpointData.githubIssueNumber
        });
    }
    
    // Update task with checkpoints
    const taskPath = path.join(TASKS_DIR, taskId);
    await fs.mkdir(taskPath, { recursive: true });
    
    const taskData = {
        id: taskId,
        name: taskName,
        objective,
        acceptanceCriteria,
        checkpoints: createdCheckpoints,
        status: 'checkpoints_created',
        created: new Date().toISOString()
    };
    
    await fs.writeFile(
        path.join(taskPath, 'task.json'),
        JSON.stringify(taskData, null, 2)
    );
    
    return res.status(200).json({
        success: true,
        taskId,
        checkpoints: createdCheckpoints,
        total: createdCheckpoints.length,
        message: `Task decomposed into ${createdCheckpoints.length} checkpoints`
    });
}

// Execute a checkpoint
async function executeCheckpoint(req, res) {
    const { checkpointId, sessionId } = req.body;
    
    if (!checkpointId) {
        return res.status(400).json({ error: 'Missing checkpointId' });
    }
    
    const checkpointPath = path.join(CHECKPOINTS_DIR, checkpointId);
    const checkpointDataPath = path.join(checkpointPath, 'checkpoint.json');
    
    try {
        const checkpointData = JSON.parse(await fs.readFile(checkpointDataPath, 'utf8'));
        
        // Update status
        checkpointData.status = 'in_progress';
        checkpointData.sessionId = sessionId;
        checkpointData.startedAt = new Date().toISOString();
        
        await fs.writeFile(checkpointDataPath, JSON.stringify(checkpointData, null, 2));
        
        // Log execution start
        checkpointData.logs.push({
            timestamp: new Date().toISOString(),
            type: 'execution_start',
            message: `Checkpoint execution started${sessionId ? ` with session ${sessionId}` : ''}`,
            sessionId
        });
        
        // Update GitHub issue
        if (checkpointData.githubIssueNumber) {
            await updateGitHubIssue(checkpointData.githubIssueNumber, {
                body: `## 🎯 Checkpoint Execution\n\n**Status:** IN PROGRESS ⏳\n**Started:** ${checkpointData.startedAt}\n${sessionId ? `**Session:** ${sessionId}` : ''}\n\n### Pass/Fail Criteria\n${checkpointData.passCriteria.map(c => `- [ ] ${c}`).join('\n')}\n\n### Execution Log\nCheckpoint execution in progress...`
            });
        }
        
        return res.status(200).json({
            success: true,
            checkpointId,
            status: 'in_progress',
            sessionId,
            message: 'Checkpoint execution started'
        });
        
    } catch (error) {
        return res.status(404).json({ error: 'Checkpoint not found' });
    }
}

// Validate checkpoint pass/fail criteria
async function validateCheckpoint(req, res) {
    const { checkpointId, testResults } = req.body;
    
    if (!checkpointId || !testResults) {
        return res.status(400).json({ 
            error: 'Missing required fields: checkpointId, testResults' 
        });
    }
    
    const checkpointPath = path.join(CHECKPOINTS_DIR, checkpointId);
    const checkpointDataPath = path.join(checkpointPath, 'checkpoint.json');
    
    try {
        const checkpointData = JSON.parse(await fs.readFile(checkpointDataPath, 'utf8'));
        
        // Validate each pass criteria
        const validationResults = [];
        let allPassed = true;
        
        for (let i = 0; i < checkpointData.passCriteria.length; i++) {
            const criterion = checkpointData.passCriteria[i];
            const result = testResults[i] || false;
            
            validationResults.push({
                criterion,
                passed: result,
                timestamp: new Date().toISOString()
            });
            
            if (!result) allPassed = false;
        }
        
        // Update checkpoint status
        checkpointData.status = allPassed ? 'passed' : 'failed';
        checkpointData.validationResults = validationResults;
        checkpointData.completedAt = new Date().toISOString();
        
        // Handle retry logic if failed
        if (!allPassed && checkpointData.retryable) {
            checkpointData.retryAttempts++;
            if (checkpointData.retryAttempts < checkpointData.maxRetries) {
                checkpointData.status = 'retry_pending';
                checkpointData.logs.push({
                    timestamp: new Date().toISOString(),
                    type: 'retry_scheduled',
                    message: `Checkpoint failed validation. Retry ${checkpointData.retryAttempts}/${checkpointData.maxRetries} scheduled.`
                });
            } else {
                checkpointData.status = 'failed_max_retries';
                checkpointData.needsEscalation = true;
                checkpointData.logs.push({
                    timestamp: new Date().toISOString(),
                    type: 'escalation_required',
                    message: `Checkpoint failed after ${checkpointData.maxRetries} retries. Escalating to Task-LLM-Resolver.`
                });
            }
        }
        
        await fs.writeFile(checkpointDataPath, JSON.stringify(checkpointData, null, 2));
        
        // Update GitHub issue
        if (checkpointData.githubIssueNumber) {
            const statusEmoji = allPassed ? '✅' : '❌';
            await updateGitHubIssue(checkpointData.githubIssueNumber, {
                body: `## ${statusEmoji} Checkpoint ${allPassed ? 'PASSED' : 'FAILED'}\n\n**Completed:** ${checkpointData.completedAt}\n\n### Validation Results\n${validationResults.map(v => `- [${v.passed ? 'x' : ' '}] ${v.criterion}`).join('\n')}\n\n${checkpointData.needsEscalation ? '### ⚠️ ESCALATION REQUIRED\nMax retries exceeded. Needs Task-LLM-Resolver intervention.' : ''}`
            });
        }
        
        return res.status(200).json({
            success: true,
            checkpointId,
            status: checkpointData.status,
            passed: allPassed,
            validationResults,
            retryAttempts: checkpointData.retryAttempts,
            needsEscalation: checkpointData.needsEscalation || false,
            message: allPassed ? 
                'Checkpoint passed all validation criteria' : 
                `Checkpoint failed validation${checkpointData.status === 'retry_pending' ? ' - retry scheduled' : ''}`
        });
        
    } catch (error) {
        return res.status(404).json({ error: 'Checkpoint not found' });
    }
}

// Get checkpoint status
async function getCheckpointStatus(req, res) {
    const { checkpointId } = req.query;
    
    if (!checkpointId) {
        return res.status(400).json({ error: 'Missing checkpointId' });
    }
    
    const checkpointPath = path.join(CHECKPOINTS_DIR, checkpointId);
    const checkpointDataPath = path.join(checkpointPath, 'checkpoint.json');
    
    try {
        const checkpointData = JSON.parse(await fs.readFile(checkpointDataPath, 'utf8'));
        
        return res.status(200).json({
            id: checkpointData.id,
            name: checkpointData.name,
            status: checkpointData.status,
            taskId: checkpointData.taskId,
            retryAttempts: checkpointData.retryAttempts,
            maxRetries: checkpointData.maxRetries,
            needsEscalation: checkpointData.needsEscalation || false,
            validationResults: checkpointData.validationResults || [],
            logs: checkpointData.logs || [],
            githubIssue: checkpointData.githubIssueNumber
        });
    } catch (error) {
        return res.status(404).json({ error: 'Checkpoint not found' });
    }
}

// Get checkpoint details
async function getCheckpoint(req, res) {
    const { checkpointId } = req.query;
    
    if (!checkpointId) {
        return res.status(400).json({ error: 'Missing checkpointId' });
    }
    
    const checkpointPath = path.join(CHECKPOINTS_DIR, checkpointId);
    const checkpointDataPath = path.join(checkpointPath, 'checkpoint.json');
    
    try {
        const checkpointData = JSON.parse(await fs.readFile(checkpointDataPath, 'utf8'));
        return res.status(200).json(checkpointData);
    } catch (error) {
        return res.status(404).json({ error: 'Checkpoint not found' });
    }
}

// Generate default checkpoints if Claude fails
function generateDefaultCheckpoints(taskName, objective, acceptanceCriteria) {
    return [
        {
            name: 'Setup and Dependencies',
            objective: 'Prepare environment and install dependencies',
            instructions: [
                'Check current environment',
                'Install required packages',
                'Verify configurations'
            ],
            passCriteria: [
                'All dependencies installed successfully',
                'No version conflicts detected',
                'Environment variables configured'
            ],
            blocking: true,
            parallelizable: false,
            dependencies: [],
            estimatedMinutes: 10,
            files: ['package.json', 'env.config'],
            retryable: true
        },
        {
            name: 'Core Implementation',
            objective: `Implement core functionality for ${taskName}`,
            instructions: [
                'Write main implementation code',
                'Add error handling',
                'Implement logging'
            ],
            passCriteria: [
                'Code compiles without errors',
                'Core functionality works as expected',
                'Error handling covers edge cases'
            ],
            blocking: true,
            parallelizable: false,
            dependencies: [],
            estimatedMinutes: 25,
            files: [],
            retryable: true
        },
        {
            name: 'Testing and Validation',
            objective: 'Test implementation and validate acceptance criteria',
            instructions: [
                'Write unit tests',
                'Run integration tests',
                'Validate against acceptance criteria'
            ],
            passCriteria: acceptanceCriteria || [
                'All tests pass',
                'Code coverage > 80%',
                'No linting errors'
            ],
            blocking: true,
            parallelizable: false,
            dependencies: [],
            estimatedMinutes: 15,
            files: [],
            retryable: true
        }
    ];
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
                'User-Agent': 'UncleFrank-CheckpointDecomposer',
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
                'User-Agent': 'UncleFrank-CheckpointDecomposer',
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