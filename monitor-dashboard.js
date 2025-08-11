const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static('.'));

// API endpoint for status
app.get('/api/monitor/status', (req, res) => {
    const status = {
        timestamp: new Date().toISOString(),
        files: [],
        currentDocs: [],
        futureDocs: [],
        lastIteration: null
    };

    // Get all JS/HTML files created (last 10)
    try {
        const files = fs.readdirSync('.')
            .filter(f => f.endsWith('.js') || f.endsWith('.html'))
            .map(f => ({
                name: f,
                size: fs.statSync(f).size,
                modified: fs.statSync(f).mtime
            }))
            .sort((a, b) => b.modified - a.modified)
            .slice(0, 10);
        status.files = files;
    } catch (e) {}

    // Read current status
    try {
        const currentStatus = fs.readFileSync('./docs-current/status.md', 'utf8');
        const lines = currentStatus.split('\n').slice(-20); // Last 20 lines
        status.currentDocs = lines;
        
        // Extract last iteration
        const iterations = currentStatus.match(/## Iteration (\d+)/g);
        if (iterations) {
            status.lastIteration = iterations[iterations.length - 1];
        }
    } catch (e) {}

    // Read future goals
    try {
        const futureGoals = fs.readFileSync('./docs-future/goals.md', 'utf8');
        status.futureDocs = futureGoals.split('\n').slice(0, 10);
    } catch (e) {}

    res.json(status);
});

// Serve the monitoring page
app.get('/monitor', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>🚀 Uncle Frank Auto-Improve Monitor</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #000;
            color: #0f0;
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            border-bottom: 2px solid #0f0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .panel {
            background: #111;
            border: 1px solid #0f0;
            padding: 15px;
            border-radius: 5px;
        }
        .panel h2 {
            margin-top: 0;
            color: #0f0;
            border-bottom: 1px solid #0f0;
            padding-bottom: 5px;
        }
        .file-list {
            list-style: none;
            padding: 0;
        }
        .file-list li {
            padding: 5px;
            margin: 2px 0;
            background: #001100;
            border-left: 3px solid #0f0;
        }
        .status-line {
            padding: 2px 0;
            font-size: 14px;
        }
        .iteration {
            color: #ff0;
            font-weight: bold;
        }
        .timestamp {
            color: #888;
            font-size: 12px;
        }
        .live-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #0f0;
            border-radius: 50%;
            margin-right: 10px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }
        .refresh-btn {
            background: #0f0;
            color: #000;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            font-weight: bold;
            margin-left: 20px;
        }
        .refresh-btn:hover {
            background: #0a0;
        }
        pre {
            background: #001100;
            padding: 10px;
            overflow-x: auto;
            font-size: 12px;
            margin: 0;
        }
        .built-file {
            color: #0ff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            <span class="live-indicator"></span>
            Uncle Frank's Auto-Improve Monitor
            <button class="refresh-btn" onclick="fetchStatus()">REFRESH</button>
        </h1>
        
        <div class="grid">
            <div class="panel">
                <h2>📋 Current Status</h2>
                <div id="current-status">
                    <pre>Loading...</pre>
                </div>
                <div class="timestamp" id="last-update"></div>
            </div>
            
            <div class="panel">
                <h2>🎯 Future Goals</h2>
                <div id="future-goals">
                    <pre>Loading...</pre>
                </div>
            </div>
        </div>
        
        <div class="panel">
            <h2>📁 Recently Created Files</h2>
            <ul class="file-list" id="file-list">
                <li>Loading...</li>
            </ul>
        </div>
        
        <div class="panel">
            <h2>📊 Live Log</h2>
            <pre id="live-log">Waiting for updates...</pre>
        </div>
    </div>

    <script>
        let autoRefresh = true;
        
        async function fetchStatus() {
            try {
                const response = await fetch('/api/monitor/status');
                const data = await response.json();
                
                // Update current status
                const currentDiv = document.getElementById('current-status');
                if (data.currentDocs && data.currentDocs.length > 0) {
                    currentDiv.innerHTML = '<pre>' + data.currentDocs
                        .join('\\n')
                        .replace(/## Iteration (\\d+)/g, '<span class="iteration">## Iteration $1</span>')
                        .replace(/Built: ([^\\s]+)/g, 'Built: <span class="built-file">$1</span>')
                        + '</pre>';
                }
                
                // Update future goals
                const futureDiv = document.getElementById('future-goals');
                if (data.futureDocs && data.futureDocs.length > 0) {
                    futureDiv.innerHTML = '<pre>' + data.futureDocs.join('\\n') + '</pre>';
                }
                
                // Update file list
                const fileList = document.getElementById('file-list');
                if (data.files && data.files.length > 0) {
                    fileList.innerHTML = data.files.map(f => 
                        '<li>' + 
                        '<strong>' + f.name + '</strong> ' +
                        '(' + f.size + ' bytes) ' +
                        '<span class="timestamp">' + new Date(f.modified).toLocaleTimeString() + '</span>' +
                        '</li>'
                    ).join('');
                }
                
                // Update timestamp
                document.getElementById('last-update').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
                
                // Update live log
                if (data.lastIteration) {
                    document.getElementById('live-log').textContent = 
                        'Last: ' + data.lastIteration + '\\n' +
                        'Status: Running\\n' +
                        'Files created: ' + data.files.length;
                }
                
            } catch (error) {
                console.error('Failed to fetch status:', error);
            }
        }
        
        // Auto-refresh every 2 seconds
        setInterval(() => {
            if (autoRefresh) fetchStatus();
        }, 2000);
        
        // Initial fetch
        fetchStatus();
    </script>
</body>
</html>`);
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`
🚀 Monitor Dashboard Running!
=============================
Open: http://localhost:${PORT}/monitor

This will show:
- Current status from docs-current/
- Future goals from docs-future/
- Recently created files
- Live iteration progress

The page auto-refreshes every 2 seconds.
    `);
});