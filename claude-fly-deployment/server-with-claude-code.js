// FRANK'S CLAUDE CODE EXECUTOR
// Uses actual Claude Code CLI instead of API
// Serverless-ready for Fly.io

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// File upload
const upload = multer({ dest: '/tmp/uploads/' });

// Session storage
const sessions = new Map();
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/workspace';

// Ensure workspace exists
fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch(console.error);

// Check if Claude Code is installed
let claudeCodeAvailable = false;
const checkClaude = spawn('which', ['claude']);
checkClaude.on('close', (code) => {
    claudeCodeAvailable = code === 0;
    console.log('Claude Code available:', claudeCodeAvailable);
});

// Execute command with Claude Code
async function executeWithClaude(sessionId, message) {
    const sessionPath = path.join(WORKSPACE_DIR, sessionId);
    
    return new Promise((resolve, reject) => {
        // Use Claude Code CLI
        const claude = spawn('claude', ['chat'], {
            cwd: sessionPath,
            env: { ...process.env, HOME: '/root' }
        });
        
        let output = '';
        let error = '';
        
        claude.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        claude.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        claude.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Claude exited with code ${code}: ${error}`));
            } else {
                resolve(output);
            }
        });
        
        // Send the message
        claude.stdin.write(message + '\n');
        claude.stdin.end();
    });
}

// Routes
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Uncle Frank Claude Code Executor (Fly.io)',
        version: '3.0.0',
        features: [
            'Claude Code CLI integration',
            'File management',
            'Real code execution',
            'Session persistence',
            'Workspace isolation'
        ],
        sessions: sessions.size,
        claudeCodeAvailable
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessions.size,
        claudeCodeAvailable
    });
});

// Create session
app.post('/api/sessions', async (req, res) => {
    try {
        const sessionId = uuidv4();
        const sessionPath = path.join(WORKSPACE_DIR, sessionId);
        
        // Create session directory
        await fs.mkdir(sessionPath, { recursive: true });
        
        // Initialize session
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'created',
            messages: [],
            files: [],
            systemPrompt: req.body.systemPrompt || 'You are Uncle Frank\'s task executor. No BS, just get it done.',
            projectPath: sessionPath
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            projectPath: sessionPath,
            url: `http://${req.get('host')}/api/sessions/${sessionId}`
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Execute task
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        session.status = 'executing';
        
        // Add user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        let responseContent;
        
        if (claudeCodeAvailable) {
            // Execute with real Claude Code
            try {
                responseContent = await executeWithClaude(sessionId, message);
            } catch (error) {
                console.error('Claude execution error:', error);
                responseContent = `Error executing with Claude: ${error.message}`;
            }
        } else {
            // Fallback to simulation
            responseContent = `[Claude Code Not Installed]
            
To enable real execution:
1. SSH into this server: fly ssh console -a uncle-frank-claude
2. Install Claude Code: npm install -g @anthropic-ai/claude-code
3. Authenticate: claude login
4. Restart the server

For now, I would:
1. Parse your task: "${message.substring(0, 50)}..."
2. Execute the checkpoints
3. Generate the code
4. Save files to workspace`;
        }
        
        session.messages.push({
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString()
        });
        
        // Update file list
        const files = await fs.readdir(session.projectPath);
        session.files = files.filter(f => !f.startsWith('.'));
        
        // Update status
        const isComplete = responseContent.toLowerCase().includes('complete') ||
                          responseContent.toLowerCase().includes('done') ||
                          responseContent.toLowerCase().includes('finished');
        
        session.status = isComplete ? 'completed' : 'active';
        
        res.json({
            success: true,
            sessionId,
            status: session.status,
            response: responseContent,
            files: session.files
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

// Get session details
app.get('/api/sessions/:sessionId', (req, res) => {
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
        lastActivity: session.messages[session.messages.length - 1]?.timestamp,
        claudeCodeAvailable
    });
});

// Get messages
app.get('/api/sessions/:sessionId/messages', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ messages: session.messages });
});

// Get files
app.get('/api/sessions/:sessionId/files', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const files = [];
        const items = await fs.readdir(session.projectPath, { withFileTypes: true });
        
        for (const item of items) {
            if (!item.name.startsWith('.')) {
                files.push({
                    name: item.name,
                    path: item.name,
                    type: item.isDirectory() ? 'directory' : 'file',
                    size: item.isFile() ? (await fs.stat(path.join(session.projectPath, item.name))).size : 0
                });
            }
        }
        
        res.json({ files });
    } catch (error) {
        console.error('File listing error:', error);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Download workspace
app.get('/api/sessions/:sessionId/download', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="workspace-${session.id}.zip"`);
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        archive.directory(session.projectPath, false);
        await archive.finalize();
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to create archive' });
    }
});

// Clear session
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Remove session directory
        await fs.rm(session.projectPath, { recursive: true, force: true });
        
        // Remove from memory
        sessions.delete(req.params.sessionId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Session cleanup error:', error);
        res.status(500).json({ error: 'Failed to clean up session' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Uncle Frank Claude Code Executor running on port ${PORT}`);
    console.log(`📍 Claude Code available: ${claudeCodeAvailable}`);
    console.log(`💾 Workspace directory: ${WORKSPACE_DIR}`);
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    console.log('Cleaning up sessions...');
    for (const [id, session] of sessions) {
        try {
            await fs.rm(session.projectPath, { recursive: true, force: true });
        } catch (error) {
            console.error(`Failed to clean up session ${id}:`, error);
        }
    }
    process.exit(0);
});