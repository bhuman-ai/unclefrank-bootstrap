// API endpoint to check auto-improve status
export default async function handler(req, res) {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
        // Check if auto-improve is running
        const { stdout: processes } = await execAsync('ps aux | grep "node auto-improve" | grep -v grep');
        const isRunning = processes.trim().length > 0;
        
        // Get last 50 lines of logs
        const { stdout: logs } = await execAsync('tail -n 50 /tmp/auto-improve-fixed.log 2>/dev/null || echo "No logs yet"');
        
        // Get current iteration status
        const { stdout: gitStatus } = await execAsync('cd /tmp/unclefrank-bootstrap 2>/dev/null && git status --short || echo "Repo not found"');
        
        res.status(200).json({
            running: isRunning,
            processes: processes.trim(),
            logs: logs,
            gitChanges: gitStatus.trim(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            running: false 
        });
    }
}