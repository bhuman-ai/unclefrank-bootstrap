// FRANK'S QUEUE-BASED CLAUDE EXECUTOR
// Uses file queue to communicate with tmux injector script

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
const CLAUDE_SESSION = 'claude-manual';
const QUEUE_DIR = '/app/command-queue';

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
        await execAsync(`/usr/bin/tmux has-session -t ${CLAUDE_SESSION} 2>/dev/null`);
        return true;
    } catch {
        return false;
    }
}

// Queue command for injection
async function queueCommand(sessionId, command) {
    try {
        // Ensure queue directory exists
        await fs.mkdir(QUEUE_DIR, { recursive: true });
        
        // Write command to queue file
        const queueFile = path.join(QUEUE_DIR, `${sessionId}.cmd`);
        await fs.writeFile(queueFile, command);
        
        console.log(`[QUEUE] Command queued for session ${sessionId}`);
        return true;
    } catch (error) {
        console.error('Failed to queue command:', error);
        return false;
    }
}

// Capture Claude's output
async function captureClaudeOutput() {
    try {
        const { stdout } = await execAsync(`/usr/bin/tmux capture-pane -t ${CLAUDE_SESSION} -p -S -200`);
        return stdout;
    } catch (error) {
        console.error('Failed to capture output:', error);
        return '';
    }
}

// Check if Claude is still processing
async function isClaudeProcessing(output) {
    // Simple check: if the output ends with prompt-related text, Claude is ready
    const lastLines = output.trim().split('\n').slice(-3).join('\n');
    
    // Check if we see "bypass permissions" or the prompt arrow at the end
    const isReady = lastLines.includes('bypass permissions') || 
                    lastLines.includes('shift+tab to cycle') ||
                    (lastLines.includes('>') && lastLines.includes('│'));
    
    // If we see these indicators, Claude is NOT processing (it's ready)
    return !isReady;
}

// Process Claude execution in background
async function processClaudeExecution(session, message) {
    try {
        console.log(`[Session ${session.id}] Starting background execution`);
        
        // Queue the command
        const queued = await queueCommand(session.id, message);
        if (!queued) {
            session.status = 'error';
            session.error = 'Failed to queue command';
            return;
        }
        
        // Wait for command to be processed by injector
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        let lastOutput = '';
        let stableCount = 0;
        
        const checkInterval = setInterval(async () => {
            attempts++;
            
            const currentOutput = await captureClaudeOutput();
            const stillProcessing = await isClaudeProcessing(currentOutput);
            
            // Debug logging
            if (attempts % 2 === 0) {
                console.log(`[Session ${session.id}] Check ${attempts}: processing=${stillProcessing}, stable=${stableCount}`);
                console.log(`Last 100 chars: ${currentOutput.slice(-100)}`);
            }
            
            if (!stillProcessing) {
                // Don't require stability - if Claude is ready, it's ready
                if (attempts >= 2) {  // Just wait for 2 checks to be sure
                        clearInterval(checkInterval);
                        
                        // Extract response - find everything between the user message and the prompt box
                        const messageIndex = currentOutput.indexOf(message.substring(0, 100)); // Find by first 100 chars
                        let response = '';
                        
                        if (messageIndex !== -1) {
                            const afterMessage = currentOutput.substring(messageIndex + message.length);
                            // Look for text between the message and the prompt box
                            // Claude's response starts after the message and ends before ╭─ prompt box
                            const promptBoxIndex = afterMessage.indexOf('╭─');
                            
                            if (promptBoxIndex > 0) {
                                response = afterMessage.substring(0, promptBoxIndex).trim();
                                // Clean up any leading bullet points or whitespace
                                response = response.replace(/^[●\s]+/, '').trim();
                            } else {
                                // No prompt box found, take everything after the message
                                response = afterMessage.trim();
                            }
                        } else {
                            // Message not found, try to extract last response before prompt
                            const promptBoxIndex = currentOutput.lastIndexOf('╭─');
                            if (promptBoxIndex > 0) {
                                // Get content before the prompt box
                                const beforePrompt = currentOutput.substring(0, promptBoxIndex);
                                // Find the last substantial block of text
                                const lines = beforePrompt.split('\n');
                                let responseLines = [];
                                // Work backwards to find response
                                for (let i = lines.length - 1; i >= 0; i--) {
                                    const line = lines[i].trim();
                                    if (line && !line.includes('bypass permissions')) {
                                        responseLines.unshift(lines[i]);
                                    } else if (responseLines.length > 0) {
                                        // Found start of response
                                        break;
                                    }
                                }
                                response = responseLines.join('\n').trim();
                            }
                        }
                        
                        // Clean response
                        response = response
                            .replace(/^[●\s]+/, '')
                            .replace(/\s*>?\s*$/, '')
                            .replace(/bypass permissions.*$/m, '')
                            .trim();
                        
                        // Store response
                        session.messages.push({
                            role: 'assistant',
                            content: response,
                            timestamp: new Date().toISOString()
                        });
                        
                        session.status = 'completed';
                        console.log(`[Session ${session.id}] Execution completed with response: ${response}`);
                }
            }
            
            // Stop after max attempts
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                session.status = 'timeout';
                session.error = 'Command timed out';
                console.log(`[Session ${session.id}] Timed out after ${attempts} attempts`);
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

// Ensure queue directory exists
fs.mkdir(QUEUE_DIR, { recursive: true }).catch(console.error);

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor (Queue-based)',
        version: '11.0-queue',
        status: 'operational',
        mode: 'queue-based-injection',
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
    const { testOnly, forceSync = false } = req.body;
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
        
        // CRITICAL: Pull latest changes from remote
        console.log(`Pulling latest changes from origin/master`);
        await execAsync(`cd ${repoPath} && git fetch origin && git pull origin master`);
        
        // Create unique branch FROM LATEST
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
        
        // Start background processing
        processClaudeExecution(session, message);
        
        // Return immediately
        res.json({
            success: true,
            sessionId,
            status: 'processing',
            message: 'Command queued for Claude. Check status endpoint for results.'
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
    
    res.json({
        id: session.id,
        created: session.created,
        status: session.status,
        messageCount: session.messages.length,
        fileCount: session.files.length,
        branch: session.branch,
        lastActivity: session.messages[session.messages.length - 1]?.timestamp
    });
});

// Get files from session
app.get('/api/sessions/:sessionId/files', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        files: [],
        modified: [],
        total: 0
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Uncle Frank's Queue-based Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Using command queue at: ${QUEUE_DIR}`);
    console.log(`Workspace: ${WORKSPACE_DIR}`);
});