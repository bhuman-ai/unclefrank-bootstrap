const express = require('express');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());

// Store process references
let processes = {
    autoImprove: null,
    monitor: null,
    nextjs: null
};

// Store logs
let logs = {
    autoImprove: [],
    system: []
};

// Main control panel
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>🚀 Uncle Frank Remote Control</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            background: #000;
            color: #0f0;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            border-bottom: 2px solid #0f0;
            padding-bottom: 15px;
        }
        .control-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .control-card {
            background: #111;
            border: 2px solid #0f0;
            padding: 20px;
            border-radius: 5px;
        }
        .control-card h2 {
            margin-top: 0;
            color: #0ff;
        }
        button {
            width: 100%;
            padding: 12px;
            margin: 5px 0;
            background: #0f0;
            color: #000;
            border: none;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
            font-family: inherit;
        }
        button:hover {
            background: #0ff;
        }
        button:disabled {
            background: #333;
            color: #666;
            cursor: not-allowed;
        }
        .status {
            padding: 10px;
            background: #001100;
            margin: 10px 0;
            border-left: 3px solid #0f0;
        }
        .status.running {
            border-left-color: #0f0;
            animation: pulse 2s infinite;
        }
        .status.stopped {
            border-left-color: #f00;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .log-panel {
            background: #111;
            border: 1px solid #0f0;
            padding: 15px;
            margin: 20px 0;
            max-height: 400px;
            overflow-y: auto;
        }
        .log-entry {
            padding: 3px 0;
            font-size: 12px;
            border-bottom: 1px solid #333;
        }
        .log-entry.error {
            color: #f00;
        }
        .log-entry.success {
            color: #0ff;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin: 20px 0;
        }
        .metric {
            background: #111;
            border: 1px solid #0f0;
            padding: 15px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            color: #0ff;
            font-weight: bold;
        }
        .metric-label {
            font-size: 12px;
            color: #888;
            margin-top: 5px;
        }
        .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        textarea {
            width: 100%;
            background: #001100;
            color: #0f0;
            border: 1px solid #0f0;
            padding: 10px;
            font-family: inherit;
            resize: vertical;
            min-height: 100px;
        }
        .quick-actions {
            background: #001100;
            border: 2px solid #0ff;
            padding: 20px;
            margin: 20px 0;
        }
        .github-info {
            background: #111;
            border: 1px solid #666;
            padding: 10px;
            margin: 10px 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Uncle Frank Remote Control Center</h1>
        
        <div class="github-info">
            📍 Codespace: <span id="codespace-name">${process.env.CODESPACE_NAME || 'Local'}</span> | 
            🌐 URL: <span id="codespace-url">${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'http://localhost'}</span>
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value" id="iterations">0</div>
                <div class="metric-label">Iterations</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="files-created">0</div>
                <div class="metric-label">Files Created</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="uptime">0m</div>
                <div class="metric-label">Uptime</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="status-indicator">⚫</div>
                <div class="metric-label">System Status</div>
            </div>
        </div>

        <div class="control-panel">
            <div class="control-card">
                <h2>🤖 Auto-Improve Engine</h2>
                <div class="status" id="auto-improve-status">Status: Stopped</div>
                <div class="action-buttons">
                    <button onclick="controlProcess('auto-improve', 'start')">START</button>
                    <button onclick="controlProcess('auto-improve', 'stop')">STOP</button>
                </div>
                <button onclick="controlProcess('auto-improve', 'restart')">RESTART</button>
            </div>

            <div class="control-card">
                <h2>📊 Monitor Dashboard</h2>
                <div class="status" id="monitor-status">Status: Stopped</div>
                <div class="action-buttons">
                    <button onclick="controlProcess('monitor', 'start')">START</button>
                    <button onclick="controlProcess('monitor', 'stop')">STOP</button>
                </div>
                <button onclick="window.open('/monitor', '_blank')">OPEN MONITOR</button>
            </div>

            <div class="control-card">
                <h2>🌐 Next.js Dashboard</h2>
                <div class="status" id="nextjs-status">Status: Stopped</div>
                <div class="action-buttons">
                    <button onclick="controlProcess('nextjs', 'start')">START</button>
                    <button onclick="controlProcess('nextjs', 'stop')">STOP</button>
                </div>
                <button onclick="window.open(':3000', '_blank')">OPEN DASHBOARD</button>
            </div>
        </div>

        <div class="quick-actions">
            <h2>⚡ Quick Actions</h2>
            <div class="action-buttons">
                <button onclick="executeCommand('git-status')">📁 Git Status</button>
                <button onclick="executeCommand('list-files')">📄 List Files</button>
                <button onclick="executeCommand('clear-logs')">🗑️ Clear Logs</button>
                <button onclick="executeCommand('show-gaps')">🎯 Show Gaps</button>
            </div>
            <h3>Run Custom Command:</h3>
            <textarea id="custom-command" placeholder="Enter command to run (e.g., ls -la, cat dashboard.html)"></textarea>
            <button onclick="runCustomCommand()">🚀 EXECUTE COMMAND</button>
        </div>

        <div class="log-panel">
            <h2>📜 System Logs</h2>
            <div id="logs"></div>
        </div>

        <div class="control-card" style="grid-column: span 2;">
            <h2>🎮 Master Controls</h2>
            <div class="action-buttons">
                <button onclick="startAll()" style="background: #0f0;">▶️ START ALL SYSTEMS</button>
                <button onclick="stopAll()" style="background: #f00; color: #fff;">⏹️ STOP ALL SYSTEMS</button>
            </div>
        </div>
    </div>

    <script>
        let startTime = Date.now();
        
        async function controlProcess(process, action) {
            const response = await fetch('/api/control/' + process + '/' + action, { method: 'POST' });
            const result = await response.json();
            addLog(result.message, result.success ? 'success' : 'error');
            updateStatus();
        }

        async function executeCommand(command) {
            const response = await fetch('/api/execute/' + command, { method: 'POST' });
            const result = await response.json();
            addLog(result.output || result.error, result.success ? 'success' : 'error');
        }

        async function runCustomCommand() {
            const command = document.getElementById('custom-command').value;
            if (!command) return;
            
            const response = await fetch('/api/execute/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const result = await response.json();
            addLog('$ ' + command + '\\n' + (result.output || result.error), result.success ? 'success' : 'error');
            document.getElementById('custom-command').value = '';
        }

        async function startAll() {
            await controlProcess('auto-improve', 'start');
            await controlProcess('monitor', 'start');
            addLog('🚀 All systems starting...', 'success');
        }

        async function stopAll() {
            await controlProcess('auto-improve', 'stop');
            await controlProcess('monitor', 'stop');
            await controlProcess('nextjs', 'stop');
            addLog('⏹️ All systems stopped', 'error');
        }

        async function updateStatus() {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            // Update status indicators
            document.getElementById('auto-improve-status').className = 'status ' + (status.autoImprove ? 'running' : 'stopped');
            document.getElementById('auto-improve-status').textContent = 'Status: ' + (status.autoImprove ? 'Running' : 'Stopped');
            
            document.getElementById('monitor-status').className = 'status ' + (status.monitor ? 'running' : 'stopped');
            document.getElementById('monitor-status').textContent = 'Status: ' + (status.monitor ? 'Running' : 'Stopped');
            
            document.getElementById('nextjs-status').className = 'status ' + (status.nextjs ? 'running' : 'stopped');
            document.getElementById('nextjs-status').textContent = 'Status: ' + (status.nextjs ? 'Running' : 'Stopped');
            
            // Update metrics
            document.getElementById('iterations').textContent = status.iterations || '0';
            document.getElementById('files-created').textContent = status.filesCreated || '0';
            document.getElementById('status-indicator').textContent = status.autoImprove ? '🟢' : '🔴';
            
            // Update uptime
            const uptime = Math.floor((Date.now() - startTime) / 60000);
            document.getElementById('uptime').textContent = uptime + 'm';
        }

        function addLog(message, type = '') {
            const logs = document.getElementById('logs');
            const entry = document.createElement('div');
            entry.className = 'log-entry ' + type;
            entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
            logs.insertBefore(entry, logs.firstChild);
            
            // Keep only last 50 logs
            while (logs.children.length > 50) {
                logs.removeChild(logs.lastChild);
            }
        }

        // Auto-refresh status
        setInterval(updateStatus, 2000);
        updateStatus();
        
        addLog('🚀 Remote Control Center initialized', 'success');
    </script>
</body>
</html>`);
});

// API endpoints
app.post('/api/control/:process/:action', (req, res) => {
    const { process, action } = req.params;
    
    if (action === 'start') {
        if (processes[process]) {
            return res.json({ success: false, message: `${process} already running` });
        }
        
        let command, args;
        switch(process) {
            case 'auto-improve':
                command = 'node';
                args = ['codespace-auto-improve.js'];
                break;
            case 'monitor':
                command = 'node';
                args = ['monitor-dashboard.js'];
                break;
            case 'nextjs':
                command = 'npm';
                args = ['run', 'dev'];
                break;
            default:
                return res.json({ success: false, message: 'Unknown process' });
        }
        
        processes[process] = spawn(command, args);
        processes[process].stdout.on('data', (data) => {
            logs.autoImprove.push(data.toString());
            console.log(`[${process}]`, data.toString());
        });
        
        res.json({ success: true, message: `${process} started` });
        
    } else if (action === 'stop') {
        if (processes[process]) {
            processes[process].kill();
            processes[process] = null;
            res.json({ success: true, message: `${process} stopped` });
        } else {
            res.json({ success: false, message: `${process} not running` });
        }
        
    } else if (action === 'restart') {
        if (processes[process]) {
            processes[process].kill();
            processes[process] = null;
        }
        // Recursively call start
        setTimeout(() => {
            req.params.action = 'start';
            app._router.handle(req, res);
        }, 1000);
    }
});

app.post('/api/execute/:command', (req, res) => {
    const { command } = req.params;
    let cmd;
    
    switch(command) {
        case 'git-status':
            cmd = 'git status --short';
            break;
        case 'list-files':
            cmd = 'ls -la *.js *.html | head -20';
            break;
        case 'clear-logs':
            logs.autoImprove = [];
            logs.system = [];
            return res.json({ success: true, output: 'Logs cleared' });
        case 'show-gaps':
            cmd = 'head -20 docs-future/goals.md';
            break;
        default:
            return res.json({ success: false, error: 'Unknown command' });
    }
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            res.json({ success: false, error: stderr || error.message });
        } else {
            res.json({ success: true, output: stdout });
        }
    });
});

app.post('/api/execute/custom', express.json(), (req, res) => {
    const { command } = req.body;
    
    // Basic safety check
    if (command.includes('rm -rf') || command.includes('sudo')) {
        return res.json({ success: false, error: 'Dangerous command blocked' });
    }
    
    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
            res.json({ success: false, error: stderr || error.message });
        } else {
            res.json({ success: true, output: stdout });
        }
    });
});

app.get('/api/status', (req, res) => {
    // Count files created
    const jsFiles = fs.readdirSync('.').filter(f => f.endsWith('.js')).length;
    const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html')).length;
    
    // Get iterations from status file
    let iterations = 0;
    try {
        const statusContent = fs.readFileSync('./docs-current/status.md', 'utf8');
        const matches = statusContent.match(/## Iteration (\d+)/g);
        if (matches) {
            iterations = matches.length;
        }
    } catch (e) {}
    
    res.json({
        autoImprove: processes.autoImprove !== null,
        monitor: processes.monitor !== null,
        nextjs: processes.nextjs !== null,
        iterations,
        filesCreated: jsFiles + htmlFiles,
        logs: logs.autoImprove.slice(-10)
    });
});

// Proxy to monitor if it's running
app.get('/monitor', (req, res) => {
    if (processes.monitor) {
        res.redirect('http://localhost:8080/monitor');
    } else {
        res.send('<h1>Monitor not running. Start it from the control panel.</h1>');
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`
🎮 UNCLE FRANK REMOTE CONTROL CENTER
=====================================
Main Control: http://localhost:${PORT}

This gives you:
✅ Start/Stop all processes
✅ View real-time status
✅ Execute commands remotely
✅ Monitor system metrics
✅ Access from anywhere via Codespaces

Your Codespace URL will be:
https://${process.env.CODESPACE_NAME}-${PORT}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'preview.app.github.dev'}
    `);
});