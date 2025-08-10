// API endpoint to stop auto-improve system
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
        // Kill all auto-improve processes
        await execAsync('pkill -f "node auto-improve" 2>/dev/null || true');
        await execAsync('pkill -f "claude --dangerously" 2>/dev/null || true');
        
        res.status(200).json({
            success: true,
            message: 'Auto-improve system stopped'
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            success: false 
        });
    }
}