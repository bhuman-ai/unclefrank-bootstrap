// Simple health check endpoint
module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Check environment
    const hasGitHubToken = !!process.env.GITHUB_TOKEN;
    const hasClaudeUrl = !!process.env.CLAUDE_EXECUTOR_URL;
    
    return res.status(200).json({
        status: 'online',
        timestamp: new Date().toISOString(),
        environment: {
            githubConfigured: hasGitHubToken,
            claudeConfigured: hasClaudeUrl,
            platform: 'vercel'
        },
        apis: {
            health: 'online',
            frankAssistant: 'available',
            projectDraftManager: 'available',
            claudeExecutor: hasClaudeUrl ? 'configured' : 'not configured'
        },
        message: hasGitHubToken ? 
            'System operational' : 
            'System needs configuration - Add GITHUB_TOKEN to environment variables'
    });
};