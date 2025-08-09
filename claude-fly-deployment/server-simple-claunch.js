// FRANK'S SIMPLIFIED CLAUNCH EXECUTOR
// Minimal server that leverages claunch for all session management

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
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
const CLAUNCH_PATH = '/usr/local/bin/claunch';

// Ensure workspace exists
fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch(console.error);

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

configureGit();

// Send message to Claude using claunch
async function sendToClaunch(sessionId, message, workDir) {
    try {
        console.log(`[Session ${sessionId}] Sending message to Claude via claunch`);
        
        // Write message to a temp file to avoid shell escaping issues
        const msgFile = path.join(workDir, `msg-${Date.now()}.txt`);
        await fs.writeFile(msgFile, message);
        
        // Execute claunch directly with the message
        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';
            
            // Use claunch in non-tmux mode for simpler execution
            const claunchProcess = spawn(CLAUNCH_PATH, [], {
                cwd: workDir,
                env: { 
                    ...process.env,
                    // Ensure claunch has proper environment
                    HOME: '/root',
                    PATH: `/root/bin:${process.env.PATH}`
                }
            });
            
            // Send the message to claunch
            claunchProcess.stdin.write(message + '\n');
            
            // Collect output
            claunchProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            claunchProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            // Handle completion
            claunchProcess.on('close', (code) => {
                console.log(`[Session ${sessionId}] Claunch process exited with code ${code}`);
                
                // Clean up temp file
                fs.unlink(msgFile).catch(() => {});
                
                if (code !== 0 && errorOutput) {
                    reject(new Error(errorOutput));
                } else {
                    // Clean the output - remove UI elements
                    const cleanOutput = output
                        .replace(/╭─+╮[\s\S]*?╰─+╯/g, '') // Remove UI boxes
                        .replace(/Welcome to Claude[\s\S]*?──────────────/g, '') // Remove welcome message
                        .replace(/\?\s+for shortcuts.*$/m, '') // Remove shortcuts line
                        .replace(/●\s+/g, '') // Remove bullet points
                        .replace(/^\s*\n/gm, '') // Remove empty lines
                        .trim();
                    
                    resolve(cleanOutput);
                }
            });
            
            // Timeout after 2 minutes
            setTimeout(() => {
                claunchProcess.kill();
                reject(new Error('Claunch execution timeout'));
            }, 120000);
        });
    } catch (error) {
        console.error(`[Session ${sessionId}] Claunch execution error:`, error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '8.0-simple-claunch',
        status: 'operational',
        mode: 'claunch-direct',
        activeSessions: sessions.size
    });
});

app.get('/health', async (req, res) => {
    try {
        const claunchExists = await fs.access(CLAUNCH_PATH)
            .then(() => true)
            .catch(() => false);
        
        const claudeAuth = await execAsync('claude auth-status')
            .then(() => true)
            .catch(() => false);
        
        res.json({ 
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            sessions: sessions.size,
            githubConfigured: !!GITHUB_TOKEN,
            claunch: claunchExists,
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
        console.log(`[Test Mode] Creating test session ${sessionId}`);
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
        // Store user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        // Send to Claude via claunch
        console.log(`[Session ${sessionId}] Executing message in ${session.repoPath}`);
        const responseContent = await sendToClaunch(sessionId, message, session.repoPath);
        
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
        // Clean up workspace if desired
        // await execAsync(`rm -rf ${session.workspaceDir}`);
        
        // Remove from sessions
        sessions.delete(req.params.sessionId);
        
        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's Simple Claunch Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Using claunch for direct Claude execution`);
});