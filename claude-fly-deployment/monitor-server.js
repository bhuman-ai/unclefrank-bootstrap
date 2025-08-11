// Simple monitoring server for auto-improve system
const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = util.promisify(exec);
const app = express();
const PORT = 8081; // Different port from main server

app.use(express.json());

// Serve the NEW monitor HTML if it exists
app.get('/', async (req, res) => {
    const htmlPath = path.join(__dirname, 'monitor.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.redirect('/monitor');
    }
});

// Get logs endpoint for the new monitor
app.get('/logs', async (req, res) => {
    try {
        const logPath = '/app/auto-improve.log';
        let logs = '';
        
        if (fs.existsSync(logPath)) {
            logs = fs.readFileSync(logPath, 'utf8');
        }
        
        // Parse logs for status info
        const lines = logs.split('\n');
        const lastLines = lines.slice(-200).join('\n');
        
        // Extract status from logs
        let status = 'RUNNING';
        let currentTask = '-';
        let gapsFound = '0';
        let iteration = '0';
        
        // Look for patterns in recent logs
        const recentLogs = lines.slice(-50).join('\n');
        
        if (recentLogs.includes('🤖 Executing with Claude')) {
            status = 'CLAUDE WORKING (NO TIMEOUT!)';
            currentTask = 'Claude is reading, thinking, and coding...';
        } else if (recentLogs.includes('⏸️ Waiting')) {
            status = 'WAITING';
            currentTask = 'Waiting for next iteration';
        } else if (recentLogs.includes('📤 Committing')) {
            status = 'PUSHING TO GITHUB';
            currentTask = 'Pushing changes to trigger Vercel';
        }
        
        // Extract gaps count
        const gapsMatch = recentLogs.match(/Found (\d+) gaps/);
        if (gapsMatch) gapsFound = gapsMatch[1];
        
        // Extract iteration
        const iterMatch = recentLogs.match(/ITERATION (\d+)/);
        if (iterMatch) iteration = iterMatch[1];
        
        // Extract current task
        const taskMatch = recentLogs.match(/🚀 Executing task: (.+)/);
        if (taskMatch) currentTask = taskMatch[1];
        
        res.json({
            logs: lastLines,
            status,
            currentTask,
            gapsFound,
            iteration,
            totalLines: lines.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve the OLD monitor page
app.get('/monitor', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uncle Frank Auto-Improve Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            background: #0a0a0a;
            color: #00ff00;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 {
            color: #ff6b6b;
            margin-bottom: 20px;
            text-shadow: 0 0 10px #ff6b6b;
        }
        .status-bar {
            background: #1a1a1a;
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 10px;
        }
        .running { background: #00ff00; box-shadow: 0 0 10px #00ff00; }
        .stopped { background: #ff4444; box-shadow: 0 0 10px #ff4444; }
        button {
            background: #1a1a1a;
            color: #00ff00;
            border: 2px solid #00ff00;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 0 5px;
        }
        button:hover {
            background: #00ff00;
            color: #0a0a0a;
        }
        .panel {
            background: #1a1a1a;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        .log-viewer {
            background: #0a0a0a;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            line-height: 1.5;
            max-height: 500px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .timestamp { color: #666; }
        .error { color: #ff4444; }
        .success { color: #00ff00; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Uncle Frank Auto-Improve Monitor</h1>
        
        <div class="status-bar">
            <div>
                <span class="status-dot" id="statusDot"></span>
                <span id="statusText">Checking...</span>
            </div>
            <div>
                <button onclick="startSystem()">🚀 Start</button>
                <button onclick="stopSystem()">⏹️ Stop</button>
                <button onclick="refresh()">🔄 Refresh</button>
            </div>
        </div>
        
        <div class="panel">
            <h2>📋 System Logs</h2>
            <div class="log-viewer" id="logs">Loading...</div>
        </div>
        
        <div class="panel">
            <h2>📁 Git Changes</h2>
            <div class="log-viewer" id="gitChanges">Loading...</div>
        </div>
    </div>
    
    <script>
        async function refresh() {
            try {
                const res = await fetch('/api/monitor/status');
                const data = await res.json();
                
                const dot = document.getElementById('statusDot');
                const text = document.getElementById('statusText');
                
                if (data.running) {
                    dot.className = 'status-dot running';
                    text.textContent = '✅ Running';
                } else {
                    dot.className = 'status-dot stopped';
                    text.textContent = '❌ Stopped';
                }
                
                document.getElementById('logs').textContent = data.logs || 'No logs';
                document.getElementById('gitChanges').textContent = data.gitChanges || 'No changes';
            } catch (err) {
                console.error(err);
            }
        }
        
        async function startSystem() {
            await fetch('/api/monitor/start', { method: 'POST' });
            setTimeout(refresh, 1000);
        }
        
        async function stopSystem() {
            await fetch('/api/monitor/stop', { method: 'POST' });
            setTimeout(refresh, 1000);
        }
        
        refresh();
        setInterval(refresh, 3000);
    </script>
</body>
</html>
    `);
});

// Serve the intelligent monitor page
app.get('/intelligent', (req, res) => {
    const intelligentMonitorPath = path.join(__dirname, 'intelligent-monitor.html');
    if (fs.existsSync(intelligentMonitorPath)) {
        res.sendFile(intelligentMonitorPath);
    } else {
        res.redirect('/monitor');
    }
});

// API endpoints
app.get('/api/monitor/status', async (req, res) => {
    try {
        const { stdout: processes } = await execAsync('ps aux | grep "node auto-improve" | grep -v grep || true');
        const isRunning = processes.trim().length > 0;
        
        // Check for intelligent auto-improve log first
        const { stdout: logs } = await execAsync('tail -n 100 /app/auto-improve.log 2>/dev/null || tail -n 100 /tmp/auto-improve-fixed.log 2>/dev/null || echo "No logs"');
        const { stdout: gitChanges } = await execAsync('cd /tmp/unclefrank-bootstrap 2>/dev/null && git status --short || echo "No repo"');
        
        res.json({
            running: isRunning,
            processes: processes.trim(),
            logs: logs,
            gitChanges: gitChanges.trim()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Intelligent status endpoint
app.get('/api/monitor/intelligent-status', async (req, res) => {
    try {
        const { stdout: processes } = await execAsync('ps aux | grep "auto-improve-intelligent" | grep -v grep || true');
        const isRunning = processes.trim().length > 0;
        
        // Get intelligent auto-improve logs
        const { stdout: logs } = await execAsync('tail -n 200 /app/auto-improve.log 2>/dev/null || echo ""');
        
        // Parse the logs to extract structured data
        const lines = logs.split('\n');
        let iteration = 0;
        let gaps = [];
        let tasks = [];
        let currentTask = '';
        let gapCount = 0;
        let taskCount = 0;
        
        lines.forEach(line => {
            // Parse iteration
            const iterMatch = line.match(/ITERATION (\d+)/);
            if (iterMatch) iteration = parseInt(iterMatch[1]);
            
            // Parse gap count
            const gapMatch = line.match(/Found (\d+) gaps/);
            if (gapMatch) gapCount = parseInt(gapMatch[1]);
            
            // Parse gaps
            const gapTypeMatch = line.match(/- (missing_\w+): (.+)/);
            if (gapTypeMatch && gaps.length < 10) {
                gaps.push({
                    type: gapTypeMatch[1],
                    description: gapTypeMatch[2].substring(0, 100)
                });
            }
            
            // Parse task count
            const taskMatch = line.match(/Generated (\d+) tasks/);
            if (taskMatch) taskCount = parseInt(taskMatch[1]);
            
            // Parse current task
            const executingMatch = line.match(/Executing top priority task: (.+)/);
            if (executingMatch) currentTask = executingMatch[1];
        });
        
        res.json({
            running: isRunning,
            iteration,
            gapCount,
            taskCount,
            gaps,
            tasks,
            currentTask,
            logs: lines.slice(-50)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/monitor/start', async (req, res) => {
    try {
        await execAsync('pkill -f "node auto-improve" 2>/dev/null || true');
        const { stdout } = await execAsync('cd /app && nohup node auto-improve-claude-cli.js > /tmp/auto-improve-fixed.log 2>&1 & echo $!');
        res.json({ success: true, pid: stdout.trim() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/monitor/stop', async (req, res) => {
    try {
        await execAsync('pkill -f "node auto-improve" 2>/dev/null || true');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Monitor server running on port \${PORT}\`);
    console.log('Access at: http://localhost:8081/monitor');
});