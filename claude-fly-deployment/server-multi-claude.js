/**
 * Multi-Claude Server
 * Manages multiple Claude instances for parallel task execution
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const MultiClaudeManager = require('./multi-claude-manager');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize multi-Claude manager
const claudeManager = new MultiClaudeManager(3); // Start with 3 instances
const sessions = new Map();

// Initialize on startup
(async () => {
    console.log('Initializing multiple Claude instances...');
    await claudeManager.initialize();
    console.log('Multi-Claude system ready!');
})();

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Multi-Claude Executor',
        version: '7.0-multi-instance',
        status: 'operational',
        claudeInstances: claudeManager.getStatus()
    });
});

app.get('/health', (req, res) => {
    const status = claudeManager.getStatus();
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessions.size,
        claudeInstances: status
    });
});

// Get Claude instances status
app.get('/api/instances', (req, res) => {
    res.json(claudeManager.getStatus());
});

// Create session (assigns to available Claude instance)
app.post('/api/sessions', async (req, res) => {
    const { repoUrl } = req.body;
    const sessionId = uuidv4();
    const branchName = `claude-session-${sessionId}`;
    const repoPath = `/workspace/${sessionId}/repo`;
    
    try {
        // Clone repository
        console.log(`Cloning ${repoUrl} to ${repoPath}`);
        await execAsync(`mkdir -p /workspace/${sessionId}`);
        await execAsync(`git clone ${repoUrl} ${repoPath}`);
        await execAsync(`cd ${repoPath} && git checkout -b ${branchName}`);
        
        // Get available Claude instance
        const instance = claudeManager.getAvailableInstance();
        if (!instance) {
            return res.status(503).json({ 
                error: 'No Claude instances available',
                status: claudeManager.getStatus()
            });
        }
        
        // Create session
        const session = {
            id: sessionId,
            claudeInstance: instance.name,
            branch: branchName,
            repoPath,
            status: 'active',
            messages: [],
            created: new Date()
        };
        
        sessions.set(sessionId, session);
        
        // Change directory in the assigned Claude instance
        await claudeManager.sendToInstance(instance.name, `cd ${repoPath}`);
        
        res.json({
            sessionId,
            status: 'created',
            branch: branchName,
            repoPath,
            claudeInstance: instance.name,
            githubUrl: `https://github.com/${repoUrl.split('/').slice(-2).join('/')}/tree/${branchName}`,
            ready: true
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session', details: error.message });
    }
});

// Execute in session
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Store user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        // Send to assigned Claude instance
        const responseContent = await claudeManager.sendToInstance(session.claudeInstance, message);
        
        session.messages.push({
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            sessionId,
            claudeInstance: session.claudeInstance,
            status: 'active',
            response: responseContent,
            instanceStatus: claudeManager.getStatus()
        });
    } catch (error) {
        console.error('Execution error:', error);
        res.status(500).json({ 
            error: 'Failed to execute command',
            details: error.message
        });
    }
});

// Execute task on any available instance (no session needed)
app.post('/api/execute-any', async (req, res) => {
    const { message } = req.body;
    
    try {
        const result = await claudeManager.executeTask(message);
        res.json({
            success: true,
            response: result,
            instanceStatus: claudeManager.getStatus()
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to execute task',
            details: error.message
        });
    }
});

// Restart specific Claude instance
app.post('/api/instances/:name/restart', async (req, res) => {
    const { name } = req.params;
    
    try {
        await claudeManager.restartInstance(name);
        res.json({
            success: true,
            message: `Instance ${name} restarted`,
            status: claudeManager.getStatus()
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to restart instance',
            details: error.message
        });
    }
});

// View instance output
app.get('/api/instances/:name/output', async (req, res) => {
    const { name } = req.params;
    const { lines = 50 } = req.query;
    
    try {
        const output = await claudeManager.viewInstance(name, parseInt(lines));
        res.json({
            instance: name,
            output,
            lines: parseInt(lines)
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to get instance output',
            details: error.message
        });
    }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    console.log('Shutting down Multi-Claude server...');
    await claudeManager.cleanup();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's Multi-Claude Executor running on port ${PORT}`);
    console.log('Initializing multiple Claude instances in tmux...');
});