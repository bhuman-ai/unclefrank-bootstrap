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
const SESSIONS_FILE = '/persistent/sessions.json';

// Load sessions from persistent storage
async function loadSessions() {
    try {
        const data = await fs.readFile(SESSIONS_FILE, 'utf8');
        const savedSessions = JSON.parse(data);
        for (const [id, session] of Object.entries(savedSessions)) {
            sessions.set(id, session);
        }
        console.log(`Loaded ${sessions.size} sessions from persistent storage`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Failed to load sessions:', error);
        }
    }
}

// Save sessions to persistent storage
async function saveSessions() {
    try {
        const sessionsObj = {};
        for (const [id, session] of sessions.entries()) {
            sessionsObj[id] = session;
        }
        await fs.mkdir('/persistent', { recursive: true });
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessionsObj, null, 2));
    } catch (error) {
        console.error('Failed to save sessions:', error);
    }
}

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
        // Capture more lines to ensure we get full responses (-S -500 = last 500 lines)
        const { stdout } = await execAsync(`/usr/bin/tmux capture-pane -t ${CLAUDE_SESSION} -p -S -500`);
        return stdout;
    } catch (error) {
        console.error('Failed to capture output:', error);
        return '';
    }
}

// Check if Claude is still processing
async function isClaudeProcessing(output) {
    // Check for Claude's processing indicators
    const lastLines = output.trim().split('\n').slice(-10).join('\n');
    
    // Claude is processing if we see any of these:
    // - "✻ Cerebrating..." / "✻ Hatching..." / "✻ Pondering..." with tokens
    // - Any thinking indicator with "tokens · esc to interrupt"
    const isThinking = (lastLines.includes('Cerebrating') || 
                       lastLines.includes('Hatching') ||
                       lastLines.includes('Pondering') ||
                       lastLines.includes('✻')) && 
                       lastLines.includes('tokens');
    
    // Check if Claude is running commands
    // When running commands, we see "esc to interrupt" WITHOUT "tokens"
    // Or we see specific running indicators
    const hasEscInterrupt = lastLines.includes('esc to interrupt');
    const hasTokens = lastLines.includes('tokens');
    const isRunningCommand = (hasEscInterrupt && !hasTokens) ||  // "esc to interrupt" without tokens = command running
                            lastLines.includes('⎿ Running') ||
                            lastLines.includes('⎿  Running') ||
                            lastLines.includes('ctrl+b ctrl+b to run in background') ||
                            lastLines.includes('to run in background');
    
    if (isThinking || isRunningCommand) {
        return true; // Still processing or running commands
    }
    
    // Check if we see the prompt box (Claude is ready)
    // But ONLY consider it ready if there's no running indicator
    const hasPromptBox = lastLines.includes('bypass permissions') || 
                        lastLines.includes('shift+tab to cycle') ||
                        (lastLines.includes('>') && lastLines.includes('│'));
    
    // Claude is ready ONLY if prompt box is present AND no commands running
    const isReady = hasPromptBox && !isRunningCommand;
    
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
        const maxAttempts = 1440; // 2 hours max (5 sec * 1440 = 7200 sec = 120 min)
        let lastOutput = '';
        let stableCount = 0;
        
        const checkInterval = setInterval(async () => {
            attempts++;
            
            const currentOutput = await captureClaudeOutput();
            const stillProcessing = await isClaudeProcessing(currentOutput);
            
            // Debug logging - more verbose for long-running tasks
            if (attempts % 2 === 0) {  // Every 10 seconds
                const runningMinutes = Math.floor((attempts * 5) / 60);
                console.log(`[Session ${session.id}] Check ${attempts}: processing=${stillProcessing}, stable=${stableCount}, running for ${runningMinutes} minutes`);
                
                // Log specific status
                const lastLines = currentOutput.trim().split('\n').slice(-5).join('\n');
                if (lastLines.includes('⎿ Running') || lastLines.includes('ctrl+b')) {
                    console.log(`[Session ${session.id}] Claude is executing commands...`);
                } else if (stillProcessing && currentOutput.includes('tokens')) {
                    const tokenMatch = currentOutput.match(/(\d+)\s+tokens/);
                    if (tokenMatch) {
                        console.log(`[Session ${session.id}] Claude is thinking... (${tokenMatch[1]} tokens processed)`);
                    }
                } else {
                    console.log(`Last 100 chars: ${currentOutput.slice(-100)}`);
                }
            }
            
            // Log milestone timings
            if (attempts === 120) { // 10 minutes
                console.log(`[Session ${session.id}] ⏰ 10 minutes elapsed - Claude still processing complex task`);
            } else if (attempts === 360) { // 30 minutes
                console.log(`[Session ${session.id}] ⏰ 30 minutes elapsed - Long-running task in progress`);
            } else if (attempts === 720) { // 1 hour
                console.log(`[Session ${session.id}] ⏰ 1 hour elapsed - Very complex task, continuing...`);
            }
            
            if (!stillProcessing) {
                // Wait for output to stabilize (no more changes)
                if (currentOutput === lastOutput) {
                    stableCount++;
                } else {
                    stableCount = 0;
                }
                
                // Require 2 stable checks (10 seconds of no changes) after Claude stops processing
                if (stableCount >= 2) {
                        clearInterval(checkInterval);
                        
                        // Extract response - Claude's response is everything between the end of thinking and prompt box
                        let response = '';
                        
                        // Method 1: Find by message text (for shorter messages)
                        const messageStart = message.substring(0, 50); // First 50 chars
                        const messageIndex = currentOutput.indexOf(messageStart);
                        
                        if (messageIndex !== -1) {
                            // Found the message, get everything after it until prompt box
                            const afterMessage = currentOutput.substring(messageIndex + message.length);
                            const promptBoxIndex = afterMessage.indexOf('╭─');
                            
                            if (promptBoxIndex > 0) {
                                response = afterMessage.substring(0, promptBoxIndex).trim();
                            } else {
                                response = afterMessage.trim();
                            }
                        } else {
                            // Method 2: Extract everything between the last bullet point and prompt box
                            // This works better for long messages that might be truncated
                            const promptBoxIndex = currentOutput.lastIndexOf('╭─');
                            
                            if (promptBoxIndex > 0) {
                                // Find Claude's response start (usually marked with ●)
                                const beforePrompt = currentOutput.substring(0, promptBoxIndex);
                                const bulletIndex = beforePrompt.lastIndexOf('●');
                                
                                if (bulletIndex !== -1) {
                                    // Get everything after the bullet until prompt
                                    response = beforePrompt.substring(bulletIndex + 1).trim();
                                } else {
                                    // No bullet found, try to get substantial text before prompt
                                    // Split by double newlines to find response blocks
                                    const blocks = beforePrompt.split(/\n\n+/);
                                    // Take last few blocks that aren't empty
                                    const significantBlocks = blocks.filter(b => b.trim().length > 10);
                                    if (significantBlocks.length > 0) {
                                        // Take the last 10 blocks or all if less
                                        const blocksToTake = Math.min(10, significantBlocks.length);
                                        response = significantBlocks.slice(-blocksToTake).join('\n\n');
                                    }
                                }
                            }
                        }
                        
                        // Format checkpoints if present
                        if (response.includes('Checkpoint') && (response.includes('Objective:') || response.includes('Deliverables:'))) {
                            // Parse and reformat checkpoints to ensure consistent structure
                            const lines = response.split('\n');
                            const formattedLines = [];
                            let inDeliverables = false;
                            let inPassCriteria = false;
                            let deliverables = [];
                            let passCriteria = [];
                            
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                const trimmedLine = line.trim();
                                
                                // Detect section changes
                                if (trimmedLine.startsWith('Checkpoint ')) {
                                    // Flush any pending deliverables/criteria
                                    if (deliverables.length > 0) {
                                        formattedLines.push(`- Deliverables: ${deliverables.join('; ')}`);
                                        deliverables = [];
                                    }
                                    if (passCriteria.length > 0) {
                                        formattedLines.push(`- Pass Criteria: ${passCriteria.join('; ')}`);
                                        passCriteria = [];
                                    }
                                    // Add checkpoint header with ### if missing
                                    if (!trimmedLine.startsWith('###')) {
                                        formattedLines.push(`### ${trimmedLine}`);
                                    } else {
                                        formattedLines.push(trimmedLine);
                                    }
                                    inDeliverables = false;
                                    inPassCriteria = false;
                                } else if (trimmedLine.startsWith('- Objective:')) {
                                    formattedLines.push(trimmedLine);
                                    inDeliverables = false;
                                    inPassCriteria = false;
                                } else if (trimmedLine.startsWith('- Deliverables:')) {
                                    inDeliverables = true;
                                    inPassCriteria = false;
                                    // Don't add yet, collect sub-items first
                                } else if (trimmedLine.startsWith('- Pass Criteria:')) {
                                    // Flush deliverables if any
                                    if (deliverables.length > 0) {
                                        formattedLines.push(`- Deliverables: ${deliverables.join('; ')}`);
                                        deliverables = [];
                                    }
                                    inDeliverables = false;
                                    inPassCriteria = true;
                                    // Don't add yet, collect sub-items first
                                } else if (trimmedLine.startsWith('- ') && (inDeliverables || inPassCriteria)) {
                                    // Sub-item of deliverables or pass criteria
                                    const item = trimmedLine.substring(2).trim();
                                    if (inDeliverables) {
                                        deliverables.push(item);
                                    } else if (inPassCriteria) {
                                        passCriteria.push(item);
                                    }
                                } else if (trimmedLine && (inDeliverables || inPassCriteria)) {
                                    // Continuation of previous item
                                    if (inDeliverables && deliverables.length > 0) {
                                        deliverables[deliverables.length - 1] += ' ' + trimmedLine;
                                    } else if (inPassCriteria && passCriteria.length > 0) {
                                        passCriteria[passCriteria.length - 1] += ' ' + trimmedLine;
                                    }
                                }
                            }
                            
                            // Flush any remaining items
                            if (deliverables.length > 0) {
                                formattedLines.push(`- Deliverables: ${deliverables.join('; ')}`);
                            }
                            if (passCriteria.length > 0) {
                                formattedLines.push(`- Pass Criteria: ${passCriteria.join('; ')}`);
                            }
                            
                            response = formattedLines.join('\n');
                        }
                        
                        // Clean up the response
                        // Remove Todo wrappers if present
                        if (response.includes('Update Todos')) {
                            // Extract content between Todo markers
                            const todoStart = response.indexOf('Update Todos');
                            const checkpointStart = response.indexOf('CP-');
                            if (checkpointStart > todoStart) {
                                // Find the actual checkpoint content
                                const lines = response.split('\n');
                                const cpLines = [];
                                let inCheckpoints = false;
                                
                                for (const line of lines) {
                                    // Start capturing when we see CP-
                                    if (line.includes('CP-')) {
                                        inCheckpoints = true;
                                    }
                                    // Stop if we see another Todo marker
                                    if (inCheckpoints && line.includes('Update Todos') && cpLines.length > 0) {
                                        break;
                                    }
                                    // Capture checkpoint lines
                                    if (inCheckpoints && (line.includes('CP-') || line.includes('Pass/Fail:') || 
                                        line.includes('Files:') || line.includes('Dependencies:') || 
                                        line.includes('Time:') || line.trim())) {
                                        // Remove leading bullets and spaces, but preserve checkpoint structure
                                        const cleanLine = line.replace(/^[\s●⎿☐☒]+/, '').trim();
                                        if (cleanLine) cpLines.push(cleanLine);
                                    }
                                }
                                
                                if (cpLines.length > 0) {
                                    response = cpLines.join('\n');
                                }
                            }
                        }
                        
                        // Final cleanup
                        response = response
                            .replace(/^[●\s]+/gm, '') // Remove bullets from all lines
                            .replace(/\s*>?\s*$/, '') // Remove trailing prompt chars
                            .replace(/bypass permissions.*$/m, '') // Remove UI elements
                            .replace(/shift\+tab to cycle.*$/m, '') // Remove UI hints
                            .trim();
                        
                        // Store response
                        session.messages.push({
                            role: 'assistant',
                            content: response,
                            timestamp: new Date().toISOString()
                        });
                        
                        session.status = 'completed';
                        await saveSessions(); // Persist after completion
                        console.log(`[Session ${session.id}] Execution completed with response: ${response}`);
                }
            }
            
            // Stop after max attempts
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                session.status = 'timeout';
                session.error = 'Command timed out';
                await saveSessions(); // Persist timeout status
                console.log(`[Session ${session.id}] Timed out after ${attempts} attempts`);
            }
            
            lastOutput = currentOutput;
        }, 5000); // Check every 5 seconds
        
    } catch (error) {
        console.error(`[Session ${session.id}] Background execution error:`, error);
        session.status = 'error';
        session.error = error.message;
        await saveSessions(); // Persist error status
    }
}

// Initialize
async function initialize() {
    await configureGit();
    await loadSessions();
    // Ensure queue directory exists
    await fs.mkdir(QUEUE_DIR, { recursive: true }).catch(console.error);
}

initialize();

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
        await saveSessions(); // Persist sessions
        
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
        await saveSessions(); // Persist status change
        
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