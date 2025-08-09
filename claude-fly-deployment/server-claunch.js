// FRANK'S CLAUNCH-BASED CLAUDE EXECUTOR
// Uses claunch for project-specific session isolation

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
const GITHUB_USER = process.env.GITHUB_USER || 'bhuman-ai';
const GITHUB_EMAIL = process.env.GITHUB_EMAIL || 'frank@unclefrank.ai';

// Session storage
const sessions = new Map();
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/workspace';

// Ensure workspace exists
fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch(console.error);

// Configure git
async function configureGit() {
    try {
        await execAsync(`git config --global user.name "${GITHUB_USER}"`);
        await execAsync(`git config --global user.email "${GITHUB_EMAIL}"`);
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

configureGit();

// Initialize claunch session for a project
async function initClaumchSession(sessionId, repoPath) {
    const sessionName = `claude-${sessionId.substring(0, 8)}`;
    
    try {
        // Change to the repo directory
        process.chdir(repoPath);
        
        // Start claunch with tmux in the project directory
        // This creates an isolated session for this specific project
        console.log(`Starting claunch session ${sessionName} in ${repoPath}`);
        
        // Create a new tmux session using claunch (use full path)
        const claunchPath = '/root/bin/claunch';
        await execAsync(`cd ${repoPath} && ${claunchPath} --tmux`, {
            env: { ...process.env, CLAUNCH_SESSION: sessionName, PATH: `/root/bin:${process.env.PATH}` }
        });
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log(`Claunch session ${sessionName} started`);
        return sessionName;
    } catch (error) {
        console.error('Failed to start claunch session:', error);
        throw error;
    }
}

// Send command to Claude via claunch session
async function sendToClaumchSession(sessionName, message, repoPath) {
    try {
        // Use a unique marker for this request
        const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const markedMessage = `# REQUEST ${requestId}\n${message}\n# END REQUEST ${requestId}`;
        
        // Find the tmux session created by claunch
        const tmuxSession = `claunch-${sessionName}`;
        
        // Check if session exists
        try {
            await execAsync(`tmux has-session -t ${tmuxSession} 2>/dev/null`);
        } catch (e) {
            // Session doesn't exist, create it
            console.log(`Creating new claunch session ${tmuxSession}`);
            const claunchPath = '/root/bin/claunch';
            await execAsync(`cd ${repoPath} && tmux new-session -d -s ${tmuxSession} '${claunchPath}'`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Send message to the session
        const escapedMessage = markedMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/'/g, "'\\''");
        
        // Send the message
        await execAsync(`tmux send-keys -t ${tmuxSession} "${escapedMessage}"`);
        await new Promise(resolve => setTimeout(resolve, 200));
        await execAsync(`tmux send-keys -t ${tmuxSession} Enter`);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Capture response
        let attempts = 0;
        let lastOutput = '';
        let isProcessing = true;
        const maxAttempts = 60;
        
        while (isProcessing && attempts < maxAttempts) {
            attempts++;
            
            const { stdout: currentOutput } = await execAsync(`tmux capture-pane -t ${tmuxSession} -p -S -200`);
            
            // Check if still processing
            const processingIndicators = ['Germinating', 'Envisioning', 'Pondering', 'Moseying', 'esc to interrupt'];
            const stillProcessing = processingIndicators.some(indicator => 
                currentOutput.includes(indicator) && 
                currentOutput.lastIndexOf(indicator) > currentOutput.lastIndexOf('●')
            );
            
            if (!stillProcessing && currentOutput !== lastOutput) {
                isProcessing = false;
                console.log(`✅ Claude finished processing after ${attempts * 5} seconds`);
            } else if (currentOutput === lastOutput && attempts > 3) {
                isProcessing = false;
                console.log(`✅ Claude appears done (no changes for 15+ seconds)`);
            } else {
                console.log(`⏳ Claude still processing... (attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            lastOutput = currentOutput;
        }
        
        // Extract response
        const { stdout: outputAfter } = await execAsync(`tmux capture-pane -t ${tmuxSession} -p -S -200`);
        
        // Extract Claude's response using our request markers
        let claudeResponse = outputAfter;
        const endRequestMarker = `END REQUEST ${requestId}`;
        const endRequestIndex = claudeResponse.indexOf(endRequestMarker);
        
        if (endRequestIndex !== -1) {
            claudeResponse = claudeResponse.substring(endRequestIndex + endRequestMarker.length);
            claudeResponse = claudeResponse
                .replace(/^[\s\n]+/, '')
                .replace(/╭─+╮[\s\S]*?╰─+╯/g, '')
                .replace(/\n\s*\?\s+for shortcuts.*$/m, '')
                .replace(/\s*Bypassing Permissions.*$/m, '')
                .replace(/Context left until auto-compact:.*$/m, '')
                .replace(/│\s*>\s*│/g, '')
                .replace(/●\s+/g, '')
                .trim();
        }
        
        console.log(`✅ Extracted Claude response: ${claudeResponse.substring(0, 100)}...`);
        return claudeResponse;
    } catch (error) {
        console.error('Failed to send to claunch session:', error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '7.0-claunch',
        status: 'operational',
        mode: 'claunch-session-management',
        activeSessions: sessions.size
    });
});

app.get('/health', async (req, res) => {
    try {
        const { stdout: tmuxVersion } = await execAsync('tmux -V').catch(() => ({ stdout: 'not installed' }));
        const { stdout: claunchVersion } = await execAsync('test -f /root/bin/claunch && echo "installed" || echo "not installed"').catch(() => ({ stdout: 'not installed' }));
        
        res.json({ 
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            sessions: sessions.size,
            githubConfigured: !!GITHUB_TOKEN,
            tmux: tmuxVersion.trim(),
            claunch: claunchVersion.trim() !== 'not installed'
        });
    } catch (error) {
        res.json({ 
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Create session with GitHub repo
app.post('/api/sessions', async (req, res) => {
    const { testOnly, repoUrl } = req.body;
    const sessionId = uuidv4();
    
    if (testOnly) {
        console.log(`[Test Mode] Creating test session ${sessionId}`);
        return res.json({
            sessionId,
            status: 'test',
            testOnly: true,
            ready: true,
            message: 'Test session created without repo clone'
        });
    }
    
    const workspaceDir = path.join(WORKSPACE_DIR, sessionId);
    const repoPath = path.join(workspaceDir, 'repo');
    
    try {
        await fs.mkdir(workspaceDir, { recursive: true });
        
        // Clone the repository
        const repoToClone = repoUrl || `https://github.com/${GITHUB_REPO}`;
        console.log(`Cloning ${repoToClone} to ${repoPath}`);
        await execAsync(`git clone https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git ${repoPath}`);
        
        // Create unique branch
        const branchName = `claude-session-${sessionId}`;
        await execAsync(`cd ${repoPath} && git checkout -b ${branchName}`);
        
        // Initialize claunch session for this project
        const claunchSession = await initClaumchSession(sessionId, repoPath);
        
        // Initialize session
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'active',
            messages: [],
            files: [],
            branch: branchName,
            repoPath,
            workspaceDir,
            claunchSession
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            status: 'created',
            branch: branchName,
            repoPath,
            githubUrl: `https://github.com/${GITHUB_REPO}/tree/${branchName}`,
            claunchSession,
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
        
        // Send to Claude via claunch
        const responseContent = await sendToClaumchSession(session.claunchSession, message, session.repoPath);
        
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
        console.error('Execution error:', error);
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
        
        // Check tmux session status
        let tmuxStatus = 'dead';
        try {
            await execAsync(`tmux has-session -t claunch-${session.claunchSession} 2>/dev/null`);
            tmuxStatus = 'alive';
        } catch (e) {
            tmuxStatus = 'dead';
        }
        
        res.json({
            id: session.id,
            created: session.created,
            status: session.status,
            messageCount: session.messages.length,
            fileCount: session.files.length,
            branch: session.branch,
            gitStatus: gitStatus.trim(),
            claunchSession: session.claunchSession,
            tmuxStatus,
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
        // Kill the claunch tmux session
        if (session.claunchSession) {
            await execAsync(`tmux kill-session -t claunch-${session.claunchSession} 2>/dev/null || true`);
            console.log(`Killed claunch session ${session.claunchSession}`);
        }
        
        // Remove from sessions
        sessions.delete(req.params.sessionId);
        
        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    console.log('Cleaning up claunch sessions...');
    for (const [id, session] of sessions) {
        try {
            if (session.claunchSession) {
                await execAsync(`tmux kill-session -t claunch-${session.claunchSession} 2>/dev/null || true`);
            }
        } catch (e) {}
    }
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's CLAUNCH Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Using claunch for project-specific session isolation`);
});