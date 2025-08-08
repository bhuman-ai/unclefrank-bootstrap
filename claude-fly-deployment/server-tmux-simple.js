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

// Use the existing manual Claude session
async function startClaudeTmuxSession(sessionId, repoPath) {
    // ALWAYS use the manual session that's already set up and authenticated
    const tmuxSession = 'claude-manual';
    const tmuxConfig = '/etc/tmux.conf';
    
    try {
        // Check if manual session exists
        try {
            await execAsync(`tmux -f ${tmuxConfig} has-session -t ${tmuxSession} 2>/dev/null`);
            console.log(`Using existing manual session ${tmuxSession}`);
        } catch (e) {
            // Manual session doesn't exist - user needs to set it up
            throw new Error('Manual Claude session not found. Please SSH in and set up claude-manual session first.');
        }
        
        // Change to the repo directory in the existing session
        await execAsync(`tmux -f ${tmuxConfig} send-keys -t ${tmuxSession} "cd ${repoPath}" Enter`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`Using manual Claude session ${tmuxSession} in ${repoPath}`);
        
        // Claude should be ready immediately thanks to config
        return tmuxSession;
    } catch (error) {
        console.error('Failed to start tmux session:', error);
        throw error;
    }
}

// Send command to Claude via tmux with VERIFICATION and SMART PARSING
async function sendToClaudeTmux(tmuxSession, message) {
    const tmuxConfig = '/etc/tmux.conf';
    // Always use the manual session
    const actualSession = 'claude-manual';
    
    try {
        // VERIFICATION STEP 1: Capture output before sending command
        const outputBefore = await execAsync(`tmux -f ${tmuxConfig} capture-pane -t ${actualSession} -p -S -100`)
            .then(res => res.stdout)
            .catch(() => '');
        
        // Mark where the user input starts for parsing
        const inputMarker = `> ${message.substring(0, 50)}`;
        
        // Special case: if message is empty or just whitespace, only send Enter
        if (!message || message.trim() === '') {
            await execAsync(`tmux -f ${tmuxConfig} send-keys -t ${actualSession} Enter`);
        } else {
            // Escape special characters in message
            const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/'/g, "'\\''");
            
            // IMPORTANT: Send text and Enter separately to ensure proper execution
            // Step 1: Send the message text to the buffer
            await execAsync(`tmux -f ${tmuxConfig} send-keys -t ${actualSession} "${escapedMessage}"`);
            
            // Step 2: Wait a moment for text to be in buffer
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Step 3: Send Enter to trigger execution
            await execAsync(`tmux -f ${tmuxConfig} send-keys -t ${actualSession} Enter`);
        }
        
        // Wait for Claude to START processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // SMART WAITING: Poll for Claude to finish processing
        let isProcessing = true;
        let attempts = 0;
        let lastOutput = '';
        const maxAttempts = 60; // Max 5 minutes (60 * 5 seconds)
        
        while (isProcessing && attempts < maxAttempts) {
            attempts++;
            
            // Capture current output
            const { stdout: currentOutput } = await execAsync(`tmux -f ${tmuxConfig} capture-pane -t ${actualSession} -p -S -200`);
            
            // Check if Claude is still processing
            const processingIndicators = ['Germinating', 'Envisioning', 'Pondering', 'Moseying', 'esc to interrupt'];
            const stillProcessing = processingIndicators.some(indicator => 
                currentOutput.includes(indicator) && 
                currentOutput.lastIndexOf(indicator) > currentOutput.lastIndexOf('●')
            );
            
            if (!stillProcessing && currentOutput !== lastOutput) {
                // Output changed and no processing indicators - Claude finished
                isProcessing = false;
                console.log(`✅ Claude finished processing after ${attempts * 5} seconds`);
            } else if (currentOutput === lastOutput && attempts > 3) {
                // No change for 15+ seconds - probably done
                isProcessing = false;
                console.log(`✅ Claude appears done (no changes for 15+ seconds)`);
            } else {
                // Still processing, wait more
                console.log(`⏳ Claude still processing... (attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            lastOutput = currentOutput;
        }
        
        // VERIFICATION STEP 2: Capture FINAL output
        const { stdout: outputAfter } = await execAsync(`tmux -f ${tmuxConfig} capture-pane -t ${actualSession} -p -S -200`);
        
        // SMART PARSING: Extract only Claude's response, not the echo or status
        let claudeResponse = outputAfter;
        
        // Remove the output that was there before
        if (outputBefore && outputAfter.startsWith(outputBefore)) {
            claudeResponse = outputAfter.substring(outputBefore.length);
        }
        
        // Remove the echoed input if present
        const inputEchoIndex = claudeResponse.indexOf(message);
        if (inputEchoIndex !== -1) {
            // Skip past the echoed input
            claudeResponse = claudeResponse.substring(inputEchoIndex + message.length);
        }
        
        // Clean up the response
        claudeResponse = claudeResponse
            .replace(/^[\s\n]+/, '') // Remove leading whitespace
            .replace(/\n\s*\?\s+for shortcuts.*$/m, '') // Remove shortcuts line
            .replace(/\s*Bypassing Permissions.*$/m, '') // Remove permissions line
            .replace(/Context left until auto-compact:.*$/m, '') // Remove context line
            .trim();
        
        // Verify we got a real response
        if (!claudeResponse || claudeResponse.length < 10) {
            console.warn('⚠️ Response seems too short, using full output');
            claudeResponse = outputAfter.substring(outputBefore.length).trim();
        }
        
        console.log(`✅ Extracted Claude response: ${claudeResponse.substring(0, 100)}...`);
        
        return claudeResponse;
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
    const { testOnly, repoUrl } = req.body;
    const sessionId = uuidv4();
    
    // REAL IMPLEMENTATION: Actually handle testOnly parameter
    if (testOnly) {
        console.log(`[Test Mode] Creating test session ${sessionId} without cloning`);
        
        // For test mode, just verify tmux is ready
        try {
            await execAsync(`tmux has-session -t claude-manual 2>/dev/null`);
            
            return res.json({
                sessionId,
                status: 'test',
                testOnly: true,
                tmuxSession: 'claude-manual',
                ready: true,
                message: 'Test session created without repo clone'
            });
        } catch (error) {
            return res.status(503).json({
                error: 'Claude tmux session not ready',
                testOnly: true,
                ready: false
            });
        }
    }
    
    // Normal mode - actually clone the repo
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
        
        // Use the existing manual Claude session
        const tmuxSession = await startClaudeTmuxSession(sessionId, repoPath);
        
        // Initialize session (always uses claude-manual)
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'active',
            messages: [],
            files: [],
            branch: branchName,
            repoPath,
            workspaceDir,
            tmuxSession: 'claude-manual'  // Always use the manual session
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
    const tmuxConfig = '/etc/tmux.conf';
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Kill tmux session (using config for consistency)
        await execAsync(`tmux -f ${tmuxConfig} kill-session -t ${session.tmuxSession} 2>/dev/null || true`);
        
        // Remove from sessions
        sessions.delete(req.params.sessionId);
        
        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    const tmuxConfig = '/etc/tmux.conf';
    console.log('Cleaning up tmux sessions...');
    for (const [id, session] of sessions) {
        try {
            await execAsync(`tmux -f ${tmuxConfig} kill-session -t ${session.tmuxSession} 2>/dev/null || true`);
        } catch (e) {}
    }
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's SIMPLE TMUX Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Claude pre-configured - no setup needed!`);
});