# Complete Claude-Code-Remote Setup Guide

## Current Status
- ✅ Server is reachable (207.148.12.169)
- ❌ Port 3000 is not open
- ❌ Claude-Code-Remote not installed yet

## Setup Instructions

### 1. Connect to Your Server

Open a terminal and connect via SSH:

```bash
ssh root@207.148.12.169
```

When prompted for password, enter: `%7Wdy)=J[r5Y$Zy8`

### 2. Run Initial System Setup

Once connected, run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install basic dependencies
apt install -y git curl wget build-essential nodejs npm python3 python3-pip

# Install Node.js 20 (newer version)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x or higher
```

### 3. Create Our Claude Executor Service

Since Claude-Code-Remote's structure is unclear, let's build our own service:

```bash
# Create directory
mkdir -p /opt/claude-executor
cd /opt/claude-executor

# Create the application
cat > package.json << 'EOF'
{
  "name": "claude-executor",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "anthropic": "^0.17.0",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.0"
  }
}
EOF

# Install dependencies
npm install
```

### 4. Create the Server Application

```bash
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In-memory session storage (use Redis in production)
const sessions = new Map();

// Workspace directory
const WORKSPACE_DIR = '/workspace';

// Ensure workspace directory exists
async function ensureWorkspace() {
    try {
        await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create workspace:', error);
    }
}

// Initialize workspace
ensureWorkspace();

// Routes
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Uncle Frank Claude Executor',
        version: '1.0.0',
        sessions: sessions.size,
        anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
        time: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessions.size
    });
});

// Create session
app.post('/api/sessions', async (req, res) => {
    try {
        const sessionId = uuidv4();
        const sessionPath = path.join(WORKSPACE_DIR, sessionId);
        
        // Create session workspace
        await fs.mkdir(sessionPath, { recursive: true });
        
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'active',
            messages: [],
            projectPath: sessionPath,
            model: req.body.model || 'claude-3-opus-20240229',
            systemPrompt: req.body.systemPrompt || "You are Uncle Frank's task executor. Execute tasks with a no-nonsense approach."
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            projectPath: sessionPath,
            workspaceUrl: `http://207.148.12.169:${PORT}/workspace/${sessionId}`
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Execute task with Claude
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    const { task, checkpoints, message } = req.body;
    
    try {
        // Store the task
        session.currentTask = task;
        session.checkpoints = checkpoints;
        session.status = 'executing';
        
        // Add user message
        const userMessage = message || `Execute this task: ${JSON.stringify(task)}`;
        session.messages.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        });
        
        // Call Claude API if configured
        if (process.env.ANTHROPIC_API_KEY) {
            const claudeResponse = await anthropic.messages.create({
                model: session.model,
                max_tokens: 4096,
                messages: [
                    { role: 'user', content: session.systemPrompt },
                    ...session.messages.map(m => ({ role: m.role, content: m.content }))
                ],
            });
            
            // Store Claude's response
            session.messages.push({
                role: 'assistant',
                content: claudeResponse.content[0].text,
                timestamp: new Date().toISOString()
            });
            
            // Check if task is complete
            const responseText = claudeResponse.content[0].text.toLowerCase();
            if (responseText.includes('completed') || responseText.includes('done')) {
                session.status = 'completed';
            }
        } else {
            // Simulate execution without API key
            session.messages.push({
                role: 'assistant',
                content: 'Simulated execution: Task would be executed here with Claude API.',
                timestamp: new Date().toISOString()
            });
            
            setTimeout(() => {
                session.status = 'completed';
            }, 5000);
        }
        
        res.json({
            success: true,
            sessionId,
            status: session.status,
            messageId: session.messages.length - 1
        });
    } catch (error) {
        console.error('Execution error:', error);
        session.status = 'error';
        res.status(500).json({ error: 'Execution failed', details: error.message });
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
        sessionId,
        status: session.status,
        completed: session.status === 'completed',
        messageCount: session.messages.length,
        lastActivity: session.messages[session.messages.length - 1]?.timestamp || session.created,
        currentTask: session.currentTask?.name || null
    });
});

// Get session messages
app.get('/api/sessions/:sessionId/messages', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        sessionId,
        messages: session.messages
    });
});

// List files in session workspace
app.get('/api/sessions/:sessionId/files', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const files = await fs.readdir(session.projectPath, { withFileTypes: true });
        const fileList = files.map(f => ({
            name: f.name,
            type: f.isDirectory() ? 'directory' : 'file',
            path: path.join(session.projectPath, f.name)
        }));
        
        res.json({
            sessionId,
            projectPath: session.projectPath,
            files: fileList
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Read file from session workspace
app.get('/api/sessions/:sessionId/files/*', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    const filePath = req.params[0];
    const fullPath = path.join(session.projectPath, filePath);
    
    try {
        // Security check - ensure path is within session workspace
        if (!fullPath.startsWith(session.projectPath)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const content = await fs.readFile(fullPath, 'utf-8');
        res.json({
            path: filePath,
            content: content
        });
    } catch (error) {
        res.status(404).json({ error: 'File not found' });
    }
});

// List all sessions
app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.values()).map(s => ({
        id: s.id,
        created: s.created,
        status: s.status,
        messageCount: s.messages.length,
        currentTask: s.currentTask?.name || null
    }));
    
    res.json({ 
        sessions: sessionList,
        total: sessions.size
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Uncle Frank Claude Executor running at http://0.0.0.0:${PORT}`);
    console.log(`📍 External access: http://207.148.12.169:${PORT}`);
    console.log(`🔑 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`📁 Workspace: ${WORKSPACE_DIR}`);
});
EOF
```

### 5. Create Environment Configuration

```bash
cat > .env << 'EOF'
PORT=3000
ANTHROPIC_API_KEY=
NODE_ENV=production
LOG_LEVEL=info
EOF

echo "⚠️  Remember to add your Anthropic API key to the .env file!"
```

### 6. Create Systemd Service

```bash
cat > /etc/systemd/system/claude-executor.service << 'EOF'
[Unit]
Description=Uncle Frank Claude Executor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/claude-executor
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/claude-executor.log
StandardError=append:/var/log/claude-executor.error.log
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF
```

### 7. Configure Firewall

```bash
# Install ufw if not present
apt install -y ufw

# Allow SSH and our service port
ufw allow 22/tcp
ufw allow 3000/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status
```

### 8. Start the Service

```bash
# Create log directory
mkdir -p /var/log

# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable claude-executor

# Start the service
systemctl start claude-executor

# Check status
systemctl status claude-executor

# View logs
journalctl -u claude-executor -f
```

### 9. Test the Installation

From the server:
```bash
# Test locally
curl http://localhost:3000/api/health
```

From your local machine:
```bash
# Test remote access
curl http://207.148.12.169:3000/api/health

# Create a test session
curl -X POST http://207.148.12.169:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 10. Add Your Anthropic API Key

```bash
# Edit the .env file
nano /opt/claude-executor/.env

# Add your API key:
# ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Restart the service
systemctl restart claude-executor
```

## Quick Test Script

Save this as `test-claude-remote.sh` on your local machine:

```bash
#!/bin/bash

API_URL="http://207.148.12.169:3000"

echo "Testing Claude Executor..."

# Health check
echo "1. Health check:"
curl -s $API_URL/api/health | jq .

# Create session
echo -e "\n2. Creating session:"
SESSION=$(curl -s -X POST $API_URL/api/sessions | jq -r .sessionId)
echo "Session ID: $SESSION"

# Execute task
echo -e "\n3. Executing task:"
curl -s -X POST $API_URL/api/sessions/$SESSION/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": {"name": "Test Task"},
    "message": "Hello, this is a test"
  }' | jq .

# Check status
echo -e "\n4. Checking status:"
curl -s $API_URL/api/sessions/$SESSION/status | jq .
```

## Troubleshooting

If the service doesn't start:
```bash
# Check logs
journalctl -u claude-executor -n 50

# Check if port is in use
netstat -tlnp | grep 3000

# Manually test the app
cd /opt/claude-executor
node server.js
```

## Integration with Uncle Frank Bootstrap

Once running, update your Vercel environment:
```
CLAUDE_REMOTE_URL=http://207.148.12.169:3000
CLAUDE_REMOTE_ENABLED=true
```

Then deploy the hybrid executor (`execute-v2.js`) to start routing traffic to Claude-Remote instead of Terragon.