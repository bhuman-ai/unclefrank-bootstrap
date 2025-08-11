// HELPER AGENTS - Uncle Frank's Specialized Support Agents
// These agents can be invoked by System Agents for specialized tasks

import https from 'https';
import fs from 'fs/promises';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'bhuman-ai/unclefrank-bootstrap';
const CLAUDE_EXECUTOR_URL = process.env.CLAUDE_EXECUTOR_URL || 'https://uncle-frank-claude.fly.dev';

// Helper agent registry
const HELPER_AGENTS = {
    // Core Workflow & Coordination
    'workflow-coordinator': {
        description: 'Orchestrates complex multi-agent workflows',
        tools: ['task', 'github', 'claude'],
        prompt: 'Coordinate workflow execution across multiple agents with precision'
    },
    'chain-planner': {
        description: 'Analyzes requests and proposes agent chains',
        tools: ['analyze', 'plan'],
        prompt: 'Design optimal agent chains for complex tasks'
    },
    'chain-executor': {
        description: 'Executes approved agent chains with checkpoints',
        tools: ['execute', 'monitor'],
        prompt: 'Execute agent chains with checkpoint validation'
    },
    
    // Documentation & Project Management
    'project-doc-manager': {
        description: 'Manages the Master Project Document',
        tools: ['read', 'write', 'validate'],
        prompt: 'Maintain Project.md with strict version control'
    },
    'taskdoc-handler': {
        description: 'Creates and maintains TaskDoc files',
        tools: ['create', 'update', 'track'],
        prompt: 'Document all task progress and decisions'
    },
    'api-documenter': {
        description: 'Creates API documentation and specs',
        tools: ['swagger', 'markdown'],
        prompt: 'Generate comprehensive API documentation'
    },
    
    // Development & Programming
    'python-pro': {
        description: 'Python development expert',
        tools: ['python', 'pip', 'pytest'],
        prompt: 'Write idiomatic Python with best practices'
    },
    'javascript-pro': {
        description: 'JavaScript/TypeScript specialist',
        tools: ['node', 'npm', 'jest'],
        prompt: 'Master modern JavaScript and Node.js'
    },
    'backend-architect': {
        description: 'Designs backend architectures',
        tools: ['api', 'database', 'microservices'],
        prompt: 'Design scalable backend systems'
    },
    'frontend-developer': {
        description: 'Builds modern web UIs',
        tools: ['react', 'css', 'webpack'],
        prompt: 'Create responsive, accessible frontends'
    },
    
    // Infrastructure & DevOps
    'cloud-architect': {
        description: 'Designs cloud infrastructure',
        tools: ['aws', 'terraform', 'docker'],
        prompt: 'Architect cloud-native solutions'
    },
    'deployment-engineer': {
        description: 'Handles deployments and CI/CD',
        tools: ['github-actions', 'docker', 'k8s'],
        prompt: 'Configure and manage deployments'
    },
    'devops-troubleshooter': {
        description: 'Debugs production issues',
        tools: ['logs', 'metrics', 'ssh'],
        prompt: 'Diagnose and fix production problems'
    },
    
    // Data & Analytics
    'data-engineer': {
        description: 'Builds data pipelines',
        tools: ['etl', 'spark', 'airflow'],
        prompt: 'Design efficient data pipelines'
    },
    'database-optimizer': {
        description: 'Optimizes database performance',
        tools: ['sql', 'indexes', 'explain'],
        prompt: 'Optimize queries and database schemas'
    },
    
    // Security & Quality
    'security-auditor': {
        description: 'Reviews code for vulnerabilities',
        tools: ['scan', 'owasp', 'pentest'],
        prompt: 'Identify and fix security vulnerabilities'
    },
    'code-reviewer': {
        description: 'Expert code review',
        tools: ['lint', 'analyze', 'suggest'],
        prompt: 'Review code for quality and maintainability'
    },
    'test-automator': {
        description: 'Creates comprehensive test suites',
        tools: ['unit', 'integration', 'e2e'],
        prompt: 'Build robust test coverage'
    },
    
    // Specialized
    'debugger': {
        description: 'Debugging specialist',
        tools: ['trace', 'profile', 'analyze'],
        prompt: 'Debug complex issues systematically'
    },
    'error-detective': {
        description: 'Searches for error patterns',
        tools: ['grep', 'logs', 'correlate'],
        prompt: 'Find root causes in error patterns'
    },
    'performance-engineer': {
        description: 'Optimizes application performance',
        tools: ['profile', 'benchmark', 'optimize'],
        prompt: 'Identify and fix performance bottlenecks'
    }
};

// Agent chain templates
const CHAIN_TEMPLATES = {
    'full-feature': [
        'chain-planner',
        'backend-architect',
        'frontend-developer',
        'test-automator',
        'code-reviewer',
        'deployment-engineer'
    ],
    'bug-fix': [
        'error-detective',
        'debugger',
        'code-reviewer',
        'test-automator'
    ],
    'performance': [
        'performance-engineer',
        'database-optimizer',
        'cloud-architect'
    ],
    'security': [
        'security-auditor',
        'code-reviewer',
        'test-automator'
    ],
    'documentation': [
        'taskdoc-handler',
        'api-documenter',
        'project-doc-manager'
    ]
};

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
            case 'invoke':
                return await invokeHelper(req, res);
            case 'chain':
                return await executeChain(req, res);
            case 'list':
                return await listHelpers(req, res);
            case 'suggest':
                return await suggestHelpers(req, res);
            case 'coordinate':
                return await coordinateWorkflow(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Helper Agent error:', error);
        return res.status(500).json({ 
            error: 'Failed to process helper request',
            details: error.message 
        });
    }
}

// Invoke a helper agent
async function invokeHelper(req, res) {
    const { agent, task, context, sessionId } = req.body;
    
    if (!agent || !task) {
        return res.status(400).json({ 
            error: 'Missing required fields: agent, task' 
        });
    }
    
    const helperConfig = HELPER_AGENTS[agent];
    if (!helperConfig) {
        return res.status(400).json({ 
            error: `Unknown helper agent: ${agent}` 
        });
    }
    
    // Create or use existing Claude session
    let claudeSession = sessionId;
    if (!claudeSession) {
        try {
            const sessionResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testOnly: false })
            });
            
            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                claudeSession = sessionData.sessionId;
            }
        } catch (error) {
            console.error('Failed to create Claude session:', error);
        }
    }
    
    // Build agent prompt
    const agentPrompt = `You are ${agent}, Uncle Frank's specialized helper.
${helperConfig.prompt}

Task: ${task}
Context: ${context || 'None provided'}

Execute this task with Frank's no-BS approach. Be specific, technical, and direct.`;
    
    // Execute via Claude
    if (claudeSession) {
        try {
            const response = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${claudeSession}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: agentPrompt })
            });
            
            if (response.ok) {
                // Log helper invocation
                await logHelperActivity(agent, task, claudeSession);
                
                return res.status(200).json({
                    success: true,
                    agent,
                    sessionId: claudeSession,
                    status: 'executing',
                    message: `Helper ${agent} invoked successfully`,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Failed to execute helper:', error);
        }
    }
    
    return res.status(500).json({
        error: 'Failed to invoke helper agent',
        agent,
        sessionId: claudeSession
    });
}

// Execute a chain of helpers
async function executeChain(req, res) {
    const { chainType, customChain, context } = req.body;
    
    let chain = customChain || CHAIN_TEMPLATES[chainType];
    
    if (!chain || chain.length === 0) {
        return res.status(400).json({ 
            error: 'Invalid chain or chain type' 
        });
    }
    
    // Create chain execution plan
    const chainId = `chain-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const executionPlan = {
        id: chainId,
        agents: chain,
        status: 'planned',
        currentIndex: 0,
        results: [],
        context,
        created: new Date().toISOString()
    };
    
    // Save chain plan
    const chainDir = '/Users/don/UncleFrank/unclefrank-bootstrap/data/chains';
    await fs.mkdir(chainDir, { recursive: true });
    await fs.writeFile(
        path.join(chainDir, `${chainId}.json`),
        JSON.stringify(executionPlan, null, 2)
    );
    
    // Start chain execution in background
    executeChainInBackground(chainId, executionPlan);
    
    return res.status(200).json({
        success: true,
        chainId,
        agents: chain,
        status: 'started',
        message: `Chain ${chainId} execution started`,
        timestamp: new Date().toISOString()
    });
}

// Execute chain in background
async function executeChainInBackground(chainId, plan) {
    const chainDir = '/Users/don/UncleFrank/unclefrank-bootstrap/data/chains';
    
    for (let i = 0; i < plan.agents.length; i++) {
        const agent = plan.agents[i];
        
        // Update plan status
        plan.currentIndex = i;
        plan.status = 'executing';
        await fs.writeFile(
            path.join(chainDir, `${chainId}.json`),
            JSON.stringify(plan, null, 2)
        );
        
        // Invoke helper
        try {
            const sessionResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testOnly: false })
            });
            
            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                const sessionId = sessionData.sessionId;
                
                const helperConfig = HELPER_AGENTS[agent];
                const agentPrompt = `You are ${agent} in a chain execution.
${helperConfig.prompt}

Context from previous agents:
${JSON.stringify(plan.results, null, 2)}

Original context: ${plan.context}

Execute your specialized task and pass relevant results to the next agent.`;
                
                const executeResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${sessionId}/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: agentPrompt })
                });
                
                if (executeResponse.ok) {
                    // Wait for completion (poll)
                    await waitForCompletion(sessionId);
                    
                    // Get results
                    const statusResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${sessionId}/status`);
                    const status = await statusResponse.json();
                    
                    plan.results.push({
                        agent,
                        sessionId,
                        result: status.lastResponse?.content || 'No response',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            plan.results.push({
                agent,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Mark chain as complete
    plan.status = 'completed';
    plan.completedAt = new Date().toISOString();
    await fs.writeFile(
        path.join(chainDir, `${chainId}.json`),
        JSON.stringify(plan, null, 2)
    );
}

// Wait for session completion
async function waitForCompletion(sessionId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        try {
            const response = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${sessionId}/status`);
            const status = await response.json();
            
            if (status.status === 'completed' || status.status === 'ready_for_review' || status.status === 'error') {
                return status;
            }
        } catch (error) {
            console.error('Status check failed:', error);
        }
    }
    
    throw new Error('Session timed out');
}

// List available helpers
async function listHelpers(req, res) {
    const { category } = req.query;
    
    let helpers = Object.entries(HELPER_AGENTS).map(([name, config]) => ({
        name,
        ...config
    }));
    
    if (category) {
        // Filter by category (based on name patterns)
        helpers = helpers.filter(h => {
            if (category === 'workflow') return h.name.includes('workflow') || h.name.includes('chain');
            if (category === 'development') return h.name.includes('pro') || h.name.includes('developer');
            if (category === 'devops') return h.name.includes('cloud') || h.name.includes('deploy');
            if (category === 'data') return h.name.includes('data') || h.name.includes('database');
            if (category === 'security') return h.name.includes('security') || h.name.includes('audit');
            return true;
        });
    }
    
    return res.status(200).json({
        helpers,
        total: helpers.length,
        chains: Object.keys(CHAIN_TEMPLATES)
    });
}

// Suggest helpers for a task
async function suggestHelpers(req, res) {
    const { task, context } = req.body;
    
    if (!task) {
        return res.status(400).json({ 
            error: 'Missing task description' 
        });
    }
    
    const suggestions = [];
    const taskLower = task.toLowerCase();
    
    // Analyze task and suggest relevant helpers
    if (taskLower.includes('bug') || taskLower.includes('error') || taskLower.includes('fix')) {
        suggestions.push(...['error-detective', 'debugger', 'devops-troubleshooter']);
    }
    
    if (taskLower.includes('performance') || taskLower.includes('slow') || taskLower.includes('optimize')) {
        suggestions.push(...['performance-engineer', 'database-optimizer']);
    }
    
    if (taskLower.includes('security') || taskLower.includes('vulnerab') || taskLower.includes('audit')) {
        suggestions.push(...['security-auditor', 'code-reviewer']);
    }
    
    if (taskLower.includes('test') || taskLower.includes('coverage') || taskLower.includes('qa')) {
        suggestions.push(...['test-automator', 'code-reviewer']);
    }
    
    if (taskLower.includes('deploy') || taskLower.includes('ci') || taskLower.includes('cd')) {
        suggestions.push(...['deployment-engineer', 'cloud-architect']);
    }
    
    if (taskLower.includes('api') || taskLower.includes('backend') || taskLower.includes('database')) {
        suggestions.push(...['backend-architect', 'api-documenter', 'database-optimizer']);
    }
    
    if (taskLower.includes('ui') || taskLower.includes('frontend') || taskLower.includes('react')) {
        suggestions.push(...['frontend-developer', 'javascript-pro']);
    }
    
    if (taskLower.includes('python')) {
        suggestions.push('python-pro');
    }
    
    if (taskLower.includes('javascript') || taskLower.includes('node')) {
        suggestions.push('javascript-pro');
    }
    
    // Remove duplicates
    const uniqueSuggestions = [...new Set(suggestions)];
    
    // If no specific suggestions, recommend workflow coordinator
    if (uniqueSuggestions.length === 0) {
        uniqueSuggestions.push('workflow-coordinator', 'chain-planner');
    }
    
    // Determine best chain template
    let recommendedChain = null;
    if (taskLower.includes('bug') || taskLower.includes('fix')) {
        recommendedChain = 'bug-fix';
    } else if (taskLower.includes('performance')) {
        recommendedChain = 'performance';
    } else if (taskLower.includes('security')) {
        recommendedChain = 'security';
    } else if (taskLower.includes('feature')) {
        recommendedChain = 'full-feature';
    }
    
    return res.status(200).json({
        task,
        suggestedHelpers: uniqueSuggestions.map(name => ({
            name,
            ...HELPER_AGENTS[name]
        })),
        recommendedChain,
        chainAgents: recommendedChain ? CHAIN_TEMPLATES[recommendedChain] : null
    });
}

// Coordinate a workflow across multiple helpers
async function coordinateWorkflow(req, res) {
    const { workflow, tasks, parallel = false } = req.body;
    
    if (!workflow || !tasks || tasks.length === 0) {
        return res.status(400).json({ 
            error: 'Missing workflow or tasks' 
        });
    }
    
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const workflowPlan = {
        id: workflowId,
        name: workflow,
        tasks,
        parallel,
        status: 'initialized',
        results: [],
        created: new Date().toISOString()
    };
    
    // Save workflow plan
    const workflowDir = '/Users/don/UncleFrank/unclefrank-bootstrap/data/workflows';
    await fs.mkdir(workflowDir, { recursive: true });
    await fs.writeFile(
        path.join(workflowDir, `${workflowId}.json`),
        JSON.stringify(workflowPlan, null, 2)
    );
    
    // Execute workflow
    if (parallel) {
        // Execute all tasks in parallel
        const promises = tasks.map(task => executeWorkflowTask(workflowId, task));
        Promise.all(promises).then(results => {
            workflowPlan.results = results;
            workflowPlan.status = 'completed';
            fs.writeFile(
                path.join(workflowDir, `${workflowId}.json`),
                JSON.stringify(workflowPlan, null, 2)
            );
        });
    } else {
        // Execute tasks sequentially
        executeWorkflowSequentially(workflowId, workflowPlan);
    }
    
    return res.status(200).json({
        success: true,
        workflowId,
        status: 'started',
        parallel,
        taskCount: tasks.length,
        message: `Workflow ${workflowId} started`,
        timestamp: new Date().toISOString()
    });
}

// Execute workflow task
async function executeWorkflowTask(workflowId, task) {
    const { agent, description, dependencies = [] } = task;
    
    // Wait for dependencies
    if (dependencies.length > 0) {
        // In production, would check dependency completion
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Execute task with helper
    try {
        const sessionResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testOnly: false })
        });
        
        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            const sessionId = sessionData.sessionId;
            
            const helperConfig = HELPER_AGENTS[agent] || { prompt: 'Execute task efficiently' };
            const agentPrompt = `You are ${agent} executing a workflow task.
${helperConfig.prompt}

Task: ${description}
Workflow: ${workflowId}

Complete this task and report results.`;
            
            const executeResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/api/sessions/${sessionId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: agentPrompt })
            });
            
            if (executeResponse.ok) {
                return {
                    agent,
                    task: description,
                    sessionId,
                    status: 'completed',
                    timestamp: new Date().toISOString()
                };
            }
        }
    } catch (error) {
        return {
            agent,
            task: description,
            error: error.message,
            status: 'failed',
            timestamp: new Date().toISOString()
        };
    }
}

// Execute workflow sequentially
async function executeWorkflowSequentially(workflowId, plan) {
    const workflowDir = '/Users/don/UncleFrank/unclefrank-bootstrap/data/workflows';
    
    for (const task of plan.tasks) {
        const result = await executeWorkflowTask(workflowId, task);
        plan.results.push(result);
        
        // Update workflow status
        await fs.writeFile(
            path.join(workflowDir, `${workflowId}.json`),
            JSON.stringify(plan, null, 2)
        );
    }
    
    plan.status = 'completed';
    plan.completedAt = new Date().toISOString();
    await fs.writeFile(
        path.join(workflowDir, `${workflowId}.json`),
        JSON.stringify(plan, null, 2)
    );
}

// Helper: Log helper agent activity
async function logHelperActivity(agent, task, sessionId) {
    const logDir = '/Users/don/UncleFrank/unclefrank-bootstrap/data/helper-logs';
    await fs.mkdir(logDir, { recursive: true });
    
    const log = {
        agent,
        task,
        sessionId,
        timestamp: new Date().toISOString()
    };
    
    const logFile = path.join(logDir, `${agent}-${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(log, null, 2));
    
    // Also create GitHub issue for tracking
    try {
        await createGitHubIssue({
            title: `Helper: ${agent} invoked`,
            body: `## Helper Agent Activity\n\n**Agent:** ${agent}\n**Task:** ${task}\n**Session:** ${sessionId}\n**Time:** ${log.timestamp}`,
            labels: ['helper-agent', agent.split('-')[0]]
        });
    } catch (error) {
        console.error('Failed to create GitHub issue:', error);
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
                'User-Agent': 'UncleFrank-HelperAgents',
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