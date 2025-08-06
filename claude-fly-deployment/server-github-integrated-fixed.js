// FRANK'S FIXED GITHUB-INTEGRATED CLAUDE EXECUTOR
// Actually runs Claude Code properly - no more fake execution!

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const pty = require('node-pty'); // Need pseudo-terminal for interactive Claude

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

// Session storage - includes Claude PTY sessions
const sessions = new Map();
const claudeSessions = new Map(); // Map of sessionId -> pty process
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/workspace';

// Ensure workspace exists
fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch(console.error);

// Configure git globally
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

// Start persistent Claude session with PTY
async function startClaudeSession(sessionId, repoPath) {
    try {
        // Kill any existing session
        const existingSession = claudeSessions.get(sessionId);
        if (existingSession) {
            existingSession.kill();
            claudeSessions.delete(sessionId);
        }

        // Create PTY session for interactive Claude
        const claudePty = pty.spawn('bash', ['-c', `cd ${repoPath} && exec claude --dangerously-skip-permissions`], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: repoPath,
            env: { ...process.env, HOME: '/root' }
        });

        // Store session output
        let sessionOutput = '';
        claudePty.on('data', (data) => {
            sessionOutput += data;
            console.log(`[Claude ${sessionId}]:`, data);
        });

        claudePty.on('exit', (code) => {
            console.log(`Claude session ${sessionId} exited with code ${code}`);
            claudeSessions.delete(sessionId);
        });

        // Store the PTY session
        claudeSessions.set(sessionId, {
            pty: claudePty,
            output: () => sessionOutput,
            clearOutput: () => { sessionOutput = ''; }
        });

        // Wait for Claude to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        return true;
    } catch (error) {
        console.error('Failed to start Claude session:', error);
        return false;
    }
}

// Execute command in Claude session
async function executeInClaudeSession(sessionId, message) {
    const claudeSession = claudeSessions.get(sessionId);
    
    if (!claudeSession) {
        // Start new session if not exists
        const session = sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        
        const started = await startClaudeSession(sessionId, session.repoPath);
        if (!started) {
            throw new Error('Failed to start Claude session');
        }
        
        // Get the newly created session
        return executeInClaudeSession(sessionId, message);
    }

    // Clear previous output
    claudeSession.clearOutput();

    // Send message to Claude
    claudeSession.pty.write(message + '\n');

    // Wait for response (with timeout)
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Claude response timeout'));
        }, 30000); // 30 second timeout

        const checkInterval = setInterval(() => {
            const output = claudeSession.output();
            
            // Check if Claude has finished responding
            // Look for prompt indicators or completion patterns
            if (output.includes('►') || output.includes('$') || 
                output.match(/\n\s*\n$/) || output.length > 1000) {
                clearInterval(checkInterval);
                clearTimeout(timeout);
                resolve(output);
            }
        }, 500);
    });
}

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '2.0-fixed',
        status: 'operational',
        mode: 'github-integrated-pty',
        claudeSessions: claudeSessions.size,
        activeSessions: sessions.size
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessions.size,
        claudeSessions: claudeSessions.size,
        githubConfigured: !!GITHUB_TOKEN
    });
});

// Create session with GitHub repo
app.post('/api/sessions', async (req, res) => {
    const sessionId = uuidv4();
    const workspaceDir = path.join(WORKSPACE_DIR, sessionId);
    const repoPath = path.join(workspaceDir, 'repo');
    
    try {
        await fs.mkdir(workspaceDir, { recursive: true });
        
        // Clone the repository
        console.log(`Cloning ${GITHUB_REPO} to ${repoPath}`);
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
        
        // Start Claude session immediately
        await startClaudeSession(sessionId, repoPath);
        
        res.json({
            sessionId,
            status: 'created',
            branch: branchName,
            repoPath,
            githubUrl: `https://github.com/${GITHUB_REPO}/tree/${branchName}`
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
        
        // Execute with Claude PTY session
        let responseContent;
        try {
            responseContent = await executeInClaudeSession(sessionId, message);
        } catch (error) {
            console.error('Claude execution failed:', error);
            // If Claude fails, at least try to execute basic git operations
            responseContent = `Error: ${error.message}`;
        }
        
        session.messages.push({
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString()
        });
        
        // List files that were created/modified
        const { stdout } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
        const modifiedFiles = stdout.split('\n').filter(line => line.trim()).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                status: parts[0],
                path: parts.slice(1).join(' ')
            };
        });
        
        session.files = modifiedFiles;
        session.status = 'active';
        
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

// Cleanup on exit
process.on('SIGTERM', () => {
    console.log('Cleaning up Claude sessions...');
    claudeSessions.forEach((session, id) => {
        session.pty.kill();
    });
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's FIXED Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Claude sessions will use PTY for proper interaction`);
});