// FIXED VERSION - Uses claude --print for direct execution
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 8080;

// Store active sessions
const sessions = new Map();

app.use(express.json({ limit: '50mb' }));

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', mode: 'direct-execution' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        service: 'Uncle Frank Claude Executor (Direct)',
        version: '2.0-direct',
        status: 'operational',
        mode: 'direct-execution',
        activeSessions: sessions.size
    });
});

// Create new session
app.post('/api/sessions', async (req, res) => {
    try {
        const sessionId = crypto.randomUUID();
        const workspacePath = `/workspace/${sessionId}`;
        
        // Create workspace
        await execAsync(`mkdir -p ${workspacePath}`);
        
        // Initialize session
        const session = {
            id: sessionId,
            status: 'created',
            workspace: workspacePath,
            created: new Date(),
            messages: []
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            status: 'created',
            workspace: workspacePath,
            ready: true
        });
        
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Execute command using claude --print
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    // Update session status
    session.status = 'processing';
    session.lastMessage = message;
    
    // Execute in background
    processClaudeExecution(session, message);
    
    res.json({
        success: true,
        sessionId,
        status: 'processing',
        message: 'Command sent to Claude for execution'
    });
});

// Process Claude execution using --print flag
async function processClaudeExecution(session, message) {
    try {
        console.log(`[Session ${session.id}] Executing with claude --print`);
        
        // Escape the message for shell
        const escapedMessage = message.replace(/'/g, "'\\''");
        
        // Execute using claude --print --dangerously-skip-permissions
        const command = `cd ${session.workspace} && claude --print --dangerously-skip-permissions '${escapedMessage}'`;
        
        console.log(`[Session ${session.id}] Running command...`);
        
        const { stdout, stderr } = await execAsync(command, {
            timeout: 300000, // 5 minute timeout
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        // Store response
        session.lastResponse = stdout;
        session.status = 'completed';
        
        // Log success
        console.log(`[Session ${session.id}] Execution completed successfully`);
        
        // Check if files were created/modified
        await checkForChanges(session);
        
    } catch (error) {
        console.error(`[Session ${session.id}] Execution error:`, error);
        session.status = 'error';
        session.error = error.message;
    }
}

// Check for file changes
async function checkForChanges(session) {
    try {
        const { stdout } = await execAsync(`find ${session.workspace} -type f -newer ${session.workspace} 2>/dev/null | head -20`);
        if (stdout.trim()) {
            session.filesCreated = stdout.trim().split('\n');
            console.log(`[Session ${session.id}] Files created/modified:`, session.filesCreated.length);
        }
    } catch (error) {
        // Ignore errors in change detection
    }
}

// Proxy monitor logs from port 8081
app.get('/api/monitor/logs', async (req, res) => {
    try {
        const fetch = require('node-fetch');
        const response = await fetch('http://localhost:8081/logs');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(503).json({ error: 'Monitor service unavailable' });
    }
});

// Get session status
app.get('/api/sessions/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        sessionId: session.id,
        status: session.status,
        lastMessage: session.lastMessage,
        lastResponse: session.lastResponse,
        filesCreated: session.filesCreated,
        error: session.error
    });
});

// List all sessions
app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.values()).map(s => ({
        id: s.id,
        status: s.status,
        created: s.created,
        workspace: s.workspace
    }));
    
    res.json({ sessions: sessionList });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Uncle Frank Claude Executor (Direct) running on port ${PORT}`);
    console.log(`✅ Using claude --print --dangerously-skip-permissions for direct execution`);
    console.log(`📦 No tmux dependency - commands execute immediately`);
});

// Cleanup old sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        const age = now - new Date(session.created).getTime();
        if (age > 3600000) { // 1 hour
            sessions.delete(id);
            console.log(`Cleaned up old session: ${id}`);
        }
    }
}, 600000); // Every 10 minutes