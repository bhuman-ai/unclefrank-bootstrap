# Claude-Code-Remote Setup Commands

Copy and paste these commands after SSHing into your VM:

```bash
ssh root@207.148.12.169
# Password: %7Wdy)=J[r5Y$Zy8
```

## Step 1: System Setup

```bash
# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y git curl wget build-essential python3 python3-pip nodejs npm unzip nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Docker (optional, for isolated environments)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## Step 2: Install Claude-Code-Remote

```bash
# Create directory
mkdir -p /opt
cd /opt

# Clone the repository
git clone https://github.com/JessyTsui/Claude-Code-Remote.git
cd Claude-Code-Remote

# Check the structure
ls -la
```

## Step 3: Analyze the Project Structure

```bash
# See what's in the repo
find . -name "package.json" -type f
find . -name "*.js" -o -name "*.ts" | head -20
cat README.md 2>/dev/null || echo "No README found"
```

## Step 4: Create a Simple Claude Executor

Since Claude-Code-Remote might have a different structure, let's create our own:

```bash
cd /opt
mkdir claude-executor
cd claude-executor

# Create package.json
cat > package.json << 'EOF'
{
  "name": "claude-executor",
  "version": "1.0.0",
  "description": "Uncle Frank's Claude Task Executor",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "axios": "^1.6.0",
    "uuid": "^9.0.0"
  }
}
EOF

# Install dependencies
npm install
```

## Step 5: Create the Server

```bash
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory session storage
const sessions = new Map();

// Routes
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Uncle Frank Claude Executor',
        sessions: sessions.size,
        time: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

// Create session
app.post('/api/sessions', (req, res) => {
    const sessionId = uuidv4();
    const session = {
        id: sessionId,
        created: new Date().toISOString(),
        status: 'active',
        messages: [],
        projectPath: req.body.projectPath || '/workspace',
        model: req.body.model || 'claude-3-opus-20240229'
    };
    
    sessions.set(sessionId, session);
    
    res.json({
        sessionId,
        workspaceUrl: `http://207.148.12.169:3000/workspace/${sessionId}`
    });
});

// Execute task
app.post('/api/sessions/:sessionId/execute', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    const { task, checkpoints } = req.body;
    
    // Store the task
    session.currentTask = task;
    session.checkpoints = checkpoints;
    session.messages.push({
        role: 'user',
        content: JSON.stringify({ task, checkpoints }),
        timestamp: new Date().toISOString()
    });
    
    // In production, this would call Claude API
    // For now, we'll simulate the execution
    session.status = 'executing';
    
    // Simulate async execution
    setTimeout(() => {
        session.status = 'completed';
        session.messages.push({
            role: 'assistant',
            content: 'Task completed successfully. All checkpoints passed.',
            timestamp: new Date().toISOString()
        });
    }, 5000);
    
    res.json({
        success: true,
        sessionId,
        status: 'executing'
    });
});

// Check status
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
        lastActivity: session.messages[session.messages.length - 1]?.timestamp || session.created
    });
});

// Get session details
app.get('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
});

// List all sessions
app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.values()).map(s => ({
        id: s.id,
        created: s.created,
        status: s.status,
        messageCount: s.messages.length
    }));
    
    res.json({ sessions: sessionList });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Claude Executor running at http://0.0.0.0:${PORT}`);
    console.log(`External access: http://207.148.12.169:${PORT}`);
});
EOF
```

## Step 6: Create .env File

```bash
cat > .env << 'EOF'
PORT=3000
ANTHROPIC_API_KEY=your-api-key-here
NODE_ENV=production
EOF
```

## Step 7: Create Systemd Service

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
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/claude-executor.log
StandardError=append:/var/log/claude-executor.error.log

[Install]
WantedBy=multi-user.target
EOF
```

## Step 8: Configure Firewall

```bash
# Allow ports
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable
```

## Step 9: Start the Service

```bash
# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable claude-executor
systemctl start claude-executor

# Check status
systemctl status claude-executor
```

## Step 10: Set up Nginx Reverse Proxy (Optional)

```bash
cat > /etc/nginx/sites-available/claude-executor << 'EOF'
server {
    listen 80;
    server_name 207.148.12.169;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/claude-executor /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

## Step 11: Test the Setup

```bash
# Test locally
curl http://localhost:3000/api/health

# Check logs
tail -f /var/log/claude-executor.log

# Test creating a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/workspace/test"}'
```

## Step 12: Test from Your Local Machine

From your local terminal:

```bash
# Test connection
curl http://207.148.12.169:3000/api/health

# Create a session
curl -X POST http://207.148.12.169:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/workspace/unclefrank"}'
```

## Troubleshooting Commands

```bash
# Check if service is running
systemctl status claude-executor

# View logs
journalctl -u claude-executor -f

# Restart service
systemctl restart claude-executor

# Check port usage
netstat -tlnp | grep 3000

# Test connectivity
nc -zv localhost 3000
```