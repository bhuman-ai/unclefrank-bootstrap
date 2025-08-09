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

// Inject command into Claude - based on Claude-Code-Remote's working implementation
async function injectCommand(command) {
    try {
        // 1. Clear input field (Ctrl+U)
        await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} C-u`);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 2. Send the ENTIRE command at once (NOT line by line!)
        // This is the key - Claude expects the full multi-line command
        const escapedCommand = command.replace(/'/g, "'\\''");
        await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} '${escapedCommand}'`);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 3. Send Enter ONCE to submit
        await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} Enter`);
        
        console.log(`Command injected: ${command.substring(0, 100)}...`);
        
        // 4. Wait and handle any confirmations (like Claude-Code-Remote does)
        await handleConfirmations();
        
        return true;
    } catch (error) {
        console.error('Failed to inject command:', error);
        return false;
    }
}

// Handle Claude confirmations (based on Claude-Code-Remote)
async function handleConfirmations() {
    const maxAttempts = 5;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        attempts++;
        
        // Wait for Claude to process
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Get current output
        const output = await captureClaudeOutput();
        
        // Check for various confirmation prompts
        if (output.includes('Do you want to proceed?') && output.includes('1. Yes')) {
            console.log('Detected confirmation prompt, auto-confirming...');
            // Send "2" for "Yes, and don't ask again" if available, otherwise "1"
            if (output.includes('2. Yes, and don\'t ask again')) {
                await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} '2'`);
            } else {
                await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} '1'`);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
            await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} Enter`);
            continue;
        }
        
        // Check for y/n prompts
        if (output.includes('(y/n)') || output.includes('[Y/n]')) {
            console.log('Detected y/n prompt, sending y...');
            await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} 'y'`);
            await new Promise(resolve => setTimeout(resolve, 300));
            await execAsync(`tmux send-keys -t ${CLAUDE_SESSION} Enter`);
            continue;
        }
        
        // Check if Claude is processing
        if (output.includes('Thinking') || output.includes('Processing') || 
            output.includes('Working') || output.includes('●')) {
            console.log('Claude is processing, waiting...');
            continue;
        }
        
        // If we see a new prompt, command is likely done
        if (output.includes('> ') && !output.includes('Do you want')) {
            console.log('Command appears to be complete');
            break;
        }
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
        
        // Just send the message directly to Claude - no cd command needed
        // Claude will use its Read/Write tools with full paths
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
                        
                        // Better response extraction using markers
                        // Find where our message ends and Claude's response begins
                        const messageEnd = currentOutput.lastIndexOf(message.substring(0, 50));
                        let response = '';
                        
                        if (messageEnd !== -1) {
                            // Get everything after our message
                            const afterMessage = currentOutput.substring(messageEnd + message.length);
                            
                            // Find Claude's response (starts after the prompt)
                            const responseMatch = afterMessage.match(/\n([^●]+?)(?:\n●|$)/s);
                            if (responseMatch) {
                                response = responseMatch[1];
                            } else {
                                response = afterMessage;
                            }
                        } else {
                            // Fallback: just get the last part
                            const lines = currentOutput.split('\n');
                            const promptIndex = lines.findIndex(line => line.includes('●'));
                            if (promptIndex > 0) {
                                response = lines.slice(0, promptIndex).join('\n');
                            }
                        }
                        
                        // Clean response
                        response = response
                            .replace(/^[\s\n]+/, '')
                            .replace(/╭─+╮[\s\S]*?╰─+╯/g, '')
                            .replace(/\n\s*\?\s+for shortcuts.*$/m, '')
                            .replace(/●\s+/g, '')
                            .replace(/bypass permissions.*$/m, '')
                            .trim();
                        
                        // Store response
                        session.messages.push({
                            role: 'assistant',
                            content: response,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Save to GitHub issue if configured
                        if (session.issueNumber && GITHUB_TOKEN) {
                            try {
                                const issueComment = `## Claude Response - ${new Date().toISOString()}\n\n\`\`\`\n${response}\n\`\`\``;
                                await execAsync(`cd ${session.repoPath} && gh issue comment ${session.issueNumber} -b "${issueComment.replace(/"/g, '\\"')}"`);
                                console.log(`[Session ${session.id}] Saved response to GitHub issue #${session.issueNumber}`);
                            } catch (ghError) {
                                console.error('Failed to save to GitHub issue:', ghError);
                            }
                        }
                        
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
    const { testOnly, repoUrl, taskTitle, taskDescription } = req.body;
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
        
        // Create GitHub issue for this task
        let issueNumber = null;
        if (GITHUB_TOKEN && taskTitle) {
            try {
                const issueTitle = taskTitle || `Task: ${sessionId}`;
                const issueBody = `## Task Session: ${sessionId}\n\n${taskDescription || 'Task execution in progress'}\n\n**Branch:** ${branchName}\n**Started:** ${new Date().toISOString()}`;
                
                const { stdout } = await execAsync(
                    `cd ${repoPath} && gh issue create --title "${issueTitle}" --body "${issueBody.replace(/"/g, '\\"')}" --label "claude-task"`,
                    { timeout: 10000 }
                );
                
                // Extract issue number from output
                const issueMatch = stdout.match(/#(\d+)/);
                if (issueMatch) {
                    issueNumber = issueMatch[1];
                    console.log(`Created GitHub issue #${issueNumber} for session ${sessionId}`);
                }
            } catch (issueError) {
                console.error('Failed to create GitHub issue:', issueError);
            }
        }
        
        // Initialize session
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'ready',
            messages: [],
            files: [],
            branch: branchName,
            repoPath,
            workspaceDir,
            issueNumber
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
        // Try to get git status with timeout
        let gitStatus = '';
        try {
            const { stdout } = await execAsync(
                `cd ${session.repoPath} && git status --porcelain`,
                { timeout: 3000 } // 3 second timeout
            );
            gitStatus = stdout.trim();
        } catch (gitError) {
            console.warn(`Git status failed for session ${req.params.sessionId}:`, gitError.message);
            gitStatus = 'unavailable';
        }
        
        res.json({
            id: session.id,
            created: session.created,
            status: session.status,
            messageCount: session.messages.length,
            fileCount: session.files.length,
            branch: session.branch,
            gitStatus,
            lastActivity: session.messages[session.messages.length - 1]?.timestamp
        });
    } catch (error) {
        console.error('Session details error:', error);
        res.status(500).json({ error: 'Failed to get session details', details: error.message });
    }
});

// Get files from session
app.get('/api/sessions/:sessionId/files', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        let files = [];
        let modified = [];
        
        // Try to get git status with timeout
        try {
            const { stdout } = await execAsync(
                `cd ${session.repoPath} && git status --porcelain`,
                { timeout: 3000 } // 3 second timeout
            );
            
            if (stdout) {
                const lines = stdout.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const status = parts[0];
                    const path = parts.slice(1).join(' ');
                    
                    if (status.includes('A') || status.includes('?')) {
                        files.push(path);
                    }
                    if (status.includes('M')) {
                        modified.push(path);
                    }
                }
            }
        } catch (gitError) {
            console.warn(`Git status failed for files in session ${req.params.sessionId}:`, gitError.message);
        }
        
        // Also include files from session if tracked
        if (session.files && session.files.length > 0) {
            for (const file of session.files) {
                if (file.status === 'A' || file.status === '??') {
                    if (!files.includes(file.path)) {
                        files.push(file.path);
                    }
                }
                if (file.status === 'M') {
                    if (!modified.includes(file.path)) {
                        modified.push(file.path);
                    }
                }
            }
        }
        
        res.json({
            files,
            modified,
            total: files.length + modified.length
        });
    } catch (error) {
        console.error('Files endpoint error:', error);
        res.status(500).json({ error: 'Failed to get files', details: error.message });
    }
});

// Commit changes
app.post('/api/sessions/:sessionId/commit', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    const { message = 'Task completed by Claude' } = req.body;
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Add all changes
        await execAsync(`cd ${session.repoPath} && git add -A`, { timeout: 5000 });
        
        // Commit
        await execAsync(
            `cd ${session.repoPath} && git commit -m "${message.replace(/"/g, '\\"')}"`,
            { timeout: 5000 }
        );
        
        // Push to remote
        await execAsync(
            `cd ${session.repoPath} && git push origin ${session.branch}`,
            { timeout: 10000 }
        );
        
        res.json({
            success: true,
            branch: session.branch,
            message: 'Changes committed and pushed successfully'
        });
    } catch (error) {
        console.error('Commit error:', error);
        res.status(500).json({ error: 'Failed to commit changes', details: error.message });
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
