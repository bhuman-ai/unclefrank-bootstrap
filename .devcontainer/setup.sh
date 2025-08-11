#!/bin/bash

echo "🚀 Setting up Uncle Frank's System in Codespaces"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install additional packages if needed
npm install -g nodemon

# Copy Claude deployment files to root for easier access
echo "📂 Setting up Claude integration..."
cp -r claude-fly-deployment/* . 2>/dev/null || true

# Create startup script
cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Uncle Frank System"
echo "================================"
echo ""
echo "Choose what to start:"
echo "1) Web Dashboard (Next.js)"
echo "2) Auto-Improve Direct"
echo "3) Task Server"
echo "4) Monitor Server"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "Starting Next.js dashboard..."
        npm run dev
        ;;
    2)
        echo "Starting Auto-Improve Direct..."
        node auto-improve-direct.js
        ;;
    3)
        echo "Starting Task Server..."
        node server-direct.js
        ;;
    4)
        echo "Starting Monitor Server..."
        node monitor-server.js
        ;;
    *)
        echo "Invalid choice. Starting Next.js by default..."
        npm run dev
        ;;
esac
EOF

chmod +x start.sh

# Create a combined server that runs everything
cat > codespace-server.js << 'EOF'
const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// State
let autoImproveProcess = null;
let isRunning = false;
let logs = [];

// Start auto-improve
app.post('/api/auto-improve/start', (req, res) => {
    if (isRunning) {
        return res.json({ error: 'Already running' });
    }

    logs = ['Starting auto-improve...'];
    isRunning = true;

    // Run the auto-improve script
    autoImproveProcess = spawn('node', ['auto-improve-direct.js']);
    
    autoImproveProcess.stdout.on('data', (data) => {
        const log = data.toString();
        logs.push(log);
        console.log('Auto-improve:', log);
    });

    autoImproveProcess.stderr.on('data', (data) => {
        const log = `ERROR: ${data.toString()}`;
        logs.push(log);
        console.error('Auto-improve error:', log);
    });

    autoImproveProcess.on('close', (code) => {
        isRunning = false;
        logs.push(`Process exited with code ${code}`);
    });

    res.json({ status: 'started' });
});

// Stop auto-improve
app.post('/api/auto-improve/stop', (req, res) => {
    if (autoImproveProcess) {
        autoImproveProcess.kill();
        isRunning = false;
        logs.push('Stopped by user');
    }
    res.json({ status: 'stopped' });
});

// Get status
app.get('/api/auto-improve/status', (req, res) => {
    res.json({
        running: isRunning,
        logs: logs.slice(-50) // Last 50 logs
    });
});

// Execute Claude command directly
app.post('/api/claude/execute', async (req, res) => {
    const { prompt } = req.body;
    
    exec(`claude --print "${prompt}"`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ error: stderr || error.message });
        }
        res.json({ output: stdout });
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
🚀 Uncle Frank's System Running!
================================
Web UI: http://localhost:${PORT}
Auto-Improve API: http://localhost:${PORT}/api/auto-improve/status

Available endpoints:
- GET  /api/auto-improve/status
- POST /api/auto-improve/start
- POST /api/auto-improve/stop
- POST /api/claude/execute
    `);
});
EOF

echo "✅ Setup complete!"
echo ""
echo "To start the system, run:"
echo "  ./start.sh"
echo ""
echo "Or run individual components:"
echo "  npm run dev           # Next.js dashboard"
echo "  node codespace-server.js  # Combined API server"
echo "  node auto-improve-direct.js  # Auto-improve loop"