const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// The loop state
let loopRunning = false;
let iteration = 0;
let logs = [];

// Read current state
function getCurrentState() {
    return {
        target: fs.readFileSync('target.md', 'utf8'),
        current: fs.existsSync('current.md') ? fs.readFileSync('current.md', 'utf8') : 'Nothing yet',
        iteration,
        logs: logs.slice(-10)
    };
}

// Run one iteration
async function runIteration() {
    iteration++;
    const log = `Iteration ${iteration}: Finding gap...`;
    logs.push(log);
    console.log(log);
    
    // Here we'd call Claude CLI, but for demo, simulate
    const gaps = [
        { file: 'task-api.js', desc: 'REST API for tasks' },
        { file: 'auto-improve.js', desc: 'Auto improvement engine' },
        { file: 'frank-personality.js', desc: 'Frank\'s personality module' }
    ];
    
    const gap = gaps[iteration % gaps.length];
    logs.push(`Found gap: ${gap.desc}`);
    
    // Update current.md
    const current = fs.readFileSync('current.md', 'utf8');
    fs.writeFileSync('current.md', current + `\n## Iteration ${iteration}\nBuilt: ${gap.file} - ${gap.desc}\n`);
    
    return gap;
}

// API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        running: loopRunning,
        ...getCurrentState()
    });
});

app.post('/api/start', async (req, res) => {
    if (loopRunning) return res.json({ error: 'Already running' });
    
    loopRunning = true;
    logs = ['🚀 Loop started'];
    
    // Run loop
    const runLoop = async () => {
        while (loopRunning) {
            await runIteration();
            await new Promise(r => setTimeout(r, 5000));
        }
    };
    
    runLoop();
    res.json({ status: 'started' });
});

app.post('/api/stop', (req, res) => {
    loopRunning = false;
    logs.push('⏹ Loop stopped');
    res.json({ status: 'stopped' });
});

app.post('/api/step', async (req, res) => {
    const result = await runIteration();
    res.json(result);
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/tasks.html');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Frank's server running at http://localhost:${PORT}`);
    console.log('Open in browser to see the dashboard');
});