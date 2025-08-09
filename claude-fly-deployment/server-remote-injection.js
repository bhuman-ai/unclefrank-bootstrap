// FRANK'S CLAUDE EXECUTOR - Based on Claude-Code-Remote's proven approach
// Uses tmux injection for reliable Claude control on Fly.io

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
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/workspace';
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

// Create Claude session if needed
async function ensureClaudeSession() {
    if (await checkClaudeSession()) {
        console.log(`Claude session ${CLAUDE_SESSION} already exists`);
        return true;
    }
    
    try {
        console.log(`Creating Claude session ${CLAUDE_SESSION}...`);
        await execAsync(`tmux new-session -d -s ${CLAUDE_SESSION} -c /app 'claude --dangerously-skip-permissions'`);
        
        // Wait for Claude to initialize
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Claude session created successfully');
        return true;
    } catch (error) {
        console.error('Failed to create Claude session:', error);
        return false;
    }
}

// Inject command into Claude using the proven 3-step approach
async function injectCommand(command, workDir = '/app') {
    try {
        // Change directory first if needed
        if (workDir !== '/app') {
            const cdCommand = `cd ${workDir}`;
            await injectCommand(cdCommand); // Recursive call for cd
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
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
        
        // Wait for Claude to start processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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

// Wait for Claude to finish processing
async function waitForClaudeCompletion(maxWaitTime = 120000) {
    const startTime = Date.now();
    let lastOutput = '';
    let stableCount = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
        const currentOutput = await captureClaudeOutput();
        
        // Check for processing indicators
        const processingIndicators = ['Germinating', 'Envisioning', 'Pondering', 'Moseying', 'esc to interrupt'];
        const stillProcessing = processingIndicators.some(indicator => 
            currentOutput.includes(indicator) && 
            currentOutput.lastIndexOf(indicator) > currentOutput.lastIndexOf('●')
        );
        
        if (!stillProcessing) {
            // Check if output is stable
            if (currentOutput === lastOutput) {
                stableCount++;
                if (stableCount >= 3) {
                    console.log('Claude appears to have finished (stable output)');
                    return currentOutput;
                }
            } else {
                stableCount = 0;
            }
        }
        
        lastOutput = currentOutput;
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Claude processing timeout');
    return lastOutput;
}

// Extract Claude's response from output
function extractClaudeResponse(fullOutput, commandSent) {
    // Find where our command appears in the output
    const commandIndex = fullOutput.lastIndexOf(commandSent);
    if (commandIndex === -1) {
        return fullOutput; // Fallback to full output
    }
    
    // Extract everything after our command
    let response = fullOutput.substring(commandIndex + commandSent.length);
    
    // Clean up the response
    response = response
        .replace(/^[\s\n]+/, '') // Remove leading whitespace
        .replace(/╭─+╮[\s\S]*?╰─+╯/g, '') // Remove UI boxes
        .replace(/\n\s*\?\s+for shortcuts.*$/m, '') // Remove shortcuts line
        .replace(/●\s+/g, '') // Remove bullet points
        .trim();
    
    return response;
}

// Initialize
configureGit();
ensureClaudeSession();

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '9.0-remote-injection',
        status: 'operational',
        mode: 'tmux-injection',
        activeSessions: sessions.size
    });
});

app.get('/health', async (req, res) => {
    try {
        const sessionExists = await checkClaudeSession();
        const claudeAuth = await execAsync('claude auth-status')
            .then(() => true)
            .catch(() => false);
        
        res.json({ 
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            sessions: sessions.size,
            githubConfigured: !!GITHUB_TOKEN,
            claudeSessionActive: sessionExists,
            claudeAuthenticated: claudeAuth
        });
    } catch (error) {
        res.json({ 
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
            status: 'active',
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

// Execute in session
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Ensure Claude session exists
        if (!await ensureClaudeSession()) {
            throw new Error('Failed to ensure Claude session');
        }
        
        // Store user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        // Inject command into Claude
        const success = await injectCommand(message, session.repoPath);
        if (!success) {
            throw new Error('Failed to inject command');
        }
        
        // Wait for Claude to complete
        const fullOutput = await waitForClaudeCompletion();
        
        // Extract Claude's response
        const responseContent = extractClaudeResponse(fullOutput, message);
        
        session.messages.push({
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString()
        });
        
        // List files that were created/modified
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
            session.files = [];
        }
        
        res.json({
            success: true,
            sessionId,
            status: session.status,
            response: responseContent,
            files: session.files,
            branch: session.branch
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
        const { stdout: gitStatus } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
        
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

// Clean up session
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Remove from sessions
        sessions.delete(req.params.sessionId);
        
        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's Remote Injection Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Using Claude-Code-Remote's proven tmux injection approach`);
});