// API endpoint to start auto-improve system
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
        // Kill any existing instances
        await execAsync('pkill -f "node auto-improve" 2>/dev/null || true');
        
        // Start the auto-improve system
        const command = 'cd /app && nohup node auto-improve-claude-cli.js > /tmp/auto-improve-fixed.log 2>&1 & echo $!';
        const { stdout: pid } = await execAsync(command);
        
        res.status(200).json({
            success: true,
            pid: pid.trim(),
            message: 'Auto-improve system started'
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            success: false 
        });
    }
}