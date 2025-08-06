// FRANK'S SIMPLIFIED TMUX CLAUDE EXECUTOR
// No theme selection needed - config handles it!

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

// Start Claude in tmux session - FULLY CONFIGURED, NO PROMPTS!
async function startClaudeTmuxSession(sessionId, repoPath) {
    const tmuxSession = `claude-${sessionId}`;
    
    try {
        // Kill any existing tmux session with same name
        await execAsync(`tmux kill-session -t ${tmuxSession} 2>/dev/null || true`);
        
        // Create new tmux session with proper config and start Claude
        // First source the tmux config, then start Claude
        const startCommand = `
            tmux -f /etc/tmux.conf new-session -d -s ${tmuxSession} -c ${repoPath} && \
            tmux send-keys -t ${tmuxSession} "claude" Enter && \
            sleep 3 && \
            tmux send-keys -t ${tmuxSession} "1" Enter && \
            sleep 2
        `;
        
        await execAsync(startCommand);
        console.log(`Started tmux session ${tmuxSession} with Claude in ${repoPath}`);
        
        // Claude should be ready immediately thanks to config
        return tmuxSession;
    } catch (error) {
        console.error('Failed to start tmux session:', error);
        throw error;
    }
}

// Send command to Claude via tmux
async function sendToClaudeTmux(tmuxSession, message) {
    try {
        // Escape special characters in message
        const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/'/g, "'\\''");
        
        // Send message to tmux session
        await execAsync(`tmux send-keys -t ${tmuxSession} "${escapedMessage}" Enter`);
        
        // Wait for Claude to process
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Capture tmux pane output (last 50 lines)
        const { stdout } = await execAsync(`tmux capture-pane -t ${tmuxSession} -p -S -50`);
        
        return stdout;
    } catch (error) {
        console.error('Failed to send to tmux:', error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '6.0-tmux-simple',
        status: 'operational',
        mode: 'tmux-with-preconfig',
        activeSessions: sessions.size
    });
});

app.get('/health', async (req, res) => {
    try {
        // Check if tmux is available
        const { stdout } = await execAsync('tmux -V');
        const tmuxVersion = stdout.trim();
        
        // Check if Claude config exists
        const configExists = await fs.access('/root/.claude/settings.json')
            .then(() => true)
            .catch(() => false);
        
        res.json({ 
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            sessions: sessions.size,
            githubConfigured: !!GITHUB_TOKEN,
            tmux: tmuxVersion,
            claudeConfigured: configExists
        });
    } catch (error) {
        res.json({ 
            status: 'unhealthy',
            error: 'tmux not available'
        });
    }
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
        
        // Start Claude in tmux (no setup needed!)
        const tmuxSession = await startClaudeTmuxSession(sessionId, repoPath);
        
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
            tmuxSession
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            status: 'created',
            branch: branchName,
            repoPath,
            githubUrl: `https://github.com/${GITHUB_REPO}/tree/${branchName}`,
            tmuxSession,
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
        
        // Send to Claude via tmux
        const responseContent = await sendToClaudeTmux(session.tmuxSession, message);
        
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
            await execAsync(`tmux has-session -t ${session.tmuxSession} 2>/dev/null`);
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
            tmuxSession: session.tmuxSession,
            tmuxStatus,
            lastActivity: session.messages[session.messages.length - 1]?.timestamp
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get session details' });
    }
});

// Kill tmux session on cleanup
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Kill tmux session
        await execAsync(`tmux kill-session -t ${session.tmuxSession} 2>/dev/null || true`);
        
        // Remove from sessions
        sessions.delete(req.params.sessionId);
        
        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    console.log('Cleaning up tmux sessions...');
    for (const [id, session] of sessions) {
        try {
            await execAsync(`tmux kill-session -t ${session.tmuxSession} 2>/dev/null || true`);
        } catch (e) {}
    }
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's SIMPLE TMUX Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Claude pre-configured - no setup needed!`);
});