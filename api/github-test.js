module.exports = async (req, res) => {
    // Test endpoint to verify GitHub token configuration
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    res.status(200).json({
        hasToken: !!GITHUB_TOKEN,
        tokenLength: GITHUB_TOKEN ? GITHUB_TOKEN.length : 0,
        tokenPrefix: GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 4) + '...' : 'NOT_SET',
        vercelEnv: process.env.VERCEL_ENV || 'not-in-vercel',
        nodeEnv: process.env.NODE_ENV,
        // List all env vars (without values) to debug
        envVars: Object.keys(process.env).filter(key => key.includes('GITHUB') || key.includes('TOKEN')).sort()
    });
};