// FRANK'S ASYNC CLAUDE EXECUTOR - Non-blocking version
// Based on Claude-Code-Remote but with async execution to prevent health check failures

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'bhuman-ai/unclefrank-bootstrap';

// Session storage
const sessions = new Map();
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/app/sessions';
const CLAUDE_SESSION = 'claude-manual'; // Use the manually authenticated session

// Configure git
async function configureGit() {
    try {
        await execAsync(`git config --global user.name "bhuman-ai"`);
        await execAsync(`git config --global user.email "frank@unclefrank.ai"`);
        if (GITHUB_TOKEN) {
            await execAsync(`git config --global credential.helper store`);
            const credPath = path.join(process.env.HOME || '/root', '.git-credentials');
            await fs.writeFile(credPath, `https://${GITHUB_TOKEN}@github.com\n`, { mode: 0o600 });
        }
        console.log('Git configured successfully');
    } catch (error) {
        console.error('Failed to configure git:', error);
    }
}

// Check if Claude session exists
async function checkClaudeSession() {
    try {
        await execAsync(`tmux has-session -t ${CLAUDE_SESSION} 2>/dev/null`);
        return true;
    } catch {
        return false;
    }
}

// Inject command into Claude using the proven 3-step approach
async function injectCommand(command) {
    try {
        // 1. Clear input field (Ctrl+U)
        await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} C-u`);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 2. Send command (escape single quotes)
        const escapedCommand = command.replace(/'/g, "'\"'\"'");
        await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} '${escapedCommand}'`);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 3. Send Enter (Ctrl+M)
        await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} C-m`);
        
        console.log(`Command injected: ${command.substring(0, 100)}...`);
        return true;
    } catch (error) {
        console.error('Failed to inject command:', error);
        return false;
    }
}

// Capture Claude's output
async function captureClaudeOutput() {
    try {
        const { stdout } = await execAsync(`tmux capture-pane -t ${CLAUDE_SESSION} -p -S -200`);
        return stdout;
    } catch (error) {
        console.error('Failed to capture output:', error);
        return '';
    }
}

// Check if Claude is still processing
async function isClaudeProcessing(output) {
    const processingIndicators = ['Germinating', 'Envisioning', 'Pondering', 'Moseying', 'esc to interrupt'];
    return processingIndicators.some(indicator => 
        output.includes(indicator) && 
        output.lastIndexOf(indicator) > output.lastIndexOf('●')
    );
}

// Process Claude execution in background
async function processClaudeExecution(session, message) {
    try {
        console.log(`[Session ${session.id}] Starting background execution`);
        
        // Inject the command directly without confusing context
        const injected = await injectCommand(message);
        if (!injected) {
            session.status = 'error';
            session.error = 'Failed to inject command';
            return;
        }
        
        // Wait for Claude to start processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Poll for completion (but don't block the server)
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        let lastOutput = '';
        let stableCount = 0;
        
        const checkInterval = setInterval(async () => {
            attempts++;
            
            const currentOutput = await captureClaudeOutput();
            const stillProcessing = await isClaudeProcessing(currentOutput);
            
            if (!stillProcessing) {
                if (currentOutput === lastOutput) {
                    stableCount++;
                    if (stableCount >= 3 || attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        
                        // Extract response
                        const responseStart = currentOutput.lastIndexOf(message);
                        let response = currentOutput;
                        if (responseStart !== -1) {
                            response = currentOutput.substring(responseStart + message.length);
                        }
                        
                        // Clean response
                        response = response
                            .replace(/^[\s\n]+/, '')
                            .replace(/╭─+╮[\s\S]*?╰─+╯/g, '')
                            .replace(/\n\s*\?\s+for shortcuts.*$/m, '')
                            .replace(/●\s+/g, '')
                            .trim();
                        
                        // Store response
                        session.messages.push({
                            role: 'assistant',
                            content: response,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Update files
                        try {
                            const { stdout } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
                            const modifiedFiles = stdout.split('\n').filter(line => line.trim()).map(line => {
                                const parts = line.trim().split(/\s+/);
                                return {
                                    status: parts[0],
                                    path: parts.slice(1).join(' ')
                                };
                            });
                            session.files = modifiedFiles;
                        } catch (error) {
                            console.error('Failed to get git status:', error);
                        }
                        
                        session.status = 'completed';
                        console.log(`[Session ${session.id}] Execution completed`);
                    }
                } else {
                    stableCount = 0;
                }
            }
            
            lastOutput = currentOutput;
        }, 5000); // Check every 5 seconds
        
    } catch (error) {
        console.error(`[Session ${session.id}] Background execution error:`, error);
        session.status = 'error';
        session.error = error.message;
    }
}

// Initialize
configureGit();

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '10.0-async-fixed',
        status: 'operational',
        mode: 'non-blocking-tmux-injection',
        activeSessions: sessions.size
    });
});

app.get('/health', async (req, res) => {
    try {
        const sessionExists = await checkClaudeSession();
        
        res.json({ 
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            sessions: sessions.size,
            activeSessions: Array.from(sessions.values()).filter(s => s.status === 'processing').length,
            githubConfigured: !!GITHUB_TOKEN,
            claudeSessionActive: sessionExists
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Create session
app.post('/api/sessions', async (req, res) => {
    const { testOnly, repoUrl } = req.body;
    const sessionId = uuidv4();
    
    if (testOnly) {
        return res.json({
            sessionId,
            status: 'test',
            testOnly: true,
            ready: true
        });
    }
    
    const workspaceDir = path.join(WORKSPACE_DIR, sessionId);
    const repoPath = path.join(workspaceDir, 'repo');
    
    try {
        await fs.mkdir(workspaceDir, { recursive: true });
        
        // Clone the repository
        console.log(`Cloning repository to ${repoPath}`);
        await execAsync(`git clone https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git ${repoPath}`);
        
        // Create unique branch
        const branchName = `claude-session-${sessionId}`;
        await execAsync(`cd ${repoPath} && git checkout -b ${branchName}`);
        
        // Initialize session
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'ready',
            messages: [],
            files: [],
            branch: branchName,
            repoPath,
            workspaceDir
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            status: 'created',
            branch: branchName,
            repoPath,
            ready: true
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session', details: error.message });
    }
});

// Execute in session (non-blocking)
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Check Claude session
        if (!await checkClaudeSession()) {
            throw new Error('Claude session not found. Please ensure claude-manual session exists.');
        }
        
        // Store user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        // Update status
        session.status = 'processing';
        
        // Start background processing (non-blocking)
        processClaudeExecution(session, message);
        
        // Return immediately
        res.json({
            success: true,
            sessionId,
            status: 'processing',
            message: 'Command sent to Claude. Check status endpoint for results.'
        });
        
    } catch (error) {
        console.error(`[Session ${sessionId}] Execution error:`, error);
        session.status = 'error';
        res.status(500).json({ 
            error: 'Execution failed', 
            details: error.message 
        });
    }
});

// Get session status
app.get('/api/sessions/:sessionId/status', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    const lastMessage = session.messages[session.messages.length - 1];
    
    res.json({
        sessionId: session.id,
        status: session.status,
        messageCount: session.messages.length,
        lastResponse: session.status === 'completed' ? lastMessage : null,
        error: session.error || null
    });
});

// Get messages
app.get('/api/sessions/:sessionId/messages', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        messages: session.messages
    });
});

// Get session details
app.get('/api/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const { stdout: gitStatus } = await execAsync(`cd ${session.repoPath} && git status --porcelain`).catch(() => ({ stdout: '' }));
        
        res.json({
            id: session.id,
            created: session.created,
            status: session.status,
            messageCount: session.messages.length,
            fileCount: session.files.length,
            branch: session.branch,
            gitStatus: gitStatus.trim(),
            lastActivity: session.messages[session.messages.length - 1]?.timestamp
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get session details' });
    }
});

// Cleanup dead sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        const lastActivity = new Date(session.messages[session.messages.length - 1]?.timestamp || session.created).getTime();
        if (now - lastActivity > 3600000) { // 1 hour
            sessions.delete(id);
            console.log(`Cleaned up inactive session ${id}`);
        }
    }
}, 300000); // Every 5 minutes

app.listen(PORT, () => {
    console.log(`Uncle Frank's Async Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Non-blocking execution prevents health check failures`);
    console.log(`Workspace: ${WORKSPACE_DIR}`);
});
