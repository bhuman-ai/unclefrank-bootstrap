module.exports = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    // Return diagnostic info
    res.status(200).json({
        timestamp: new Date().toISOString(),
        environment: {
            hasToken: !!GITHUB_TOKEN,
            tokenLength: GITHUB_TOKEN ? GITHUB_TOKEN.length : 0,
            tokenPrefix: GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 8) + '...' : 'NOT_SET',
            vercelEnv: process.env.VERCEL_ENV || 'not-in-vercel',
            nodeEnv: process.env.NODE_ENV || 'not-set',
            nodeVersion: process.version
        },
        // Show all env vars that might be related (without values)
        relatedEnvVars: Object.keys(process.env)
            .filter(key => 
                key.includes('GITHUB') || 
                key.includes('TOKEN') || 
                key.includes('VERCEL')
            )
            .sort(),
        // Check if common env var naming variations exist
        commonVariations: {
            GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
            GITHUB_ACCESS_TOKEN: !!process.env.GITHUB_ACCESS_TOKEN,
            GITHUB_PERSONAL_ACCESS_TOKEN: !!process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
            GH_TOKEN: !!process.env.GH_TOKEN,
            REACT_APP_GITHUB_TOKEN: !!process.env.REACT_APP_GITHUB_TOKEN
        },
        // Debug info
        debug: {
            isVercel: !!process.env.VERCEL,
            hasAnyEnvVars: Object.keys(process.env).length > 0,
            envVarCount: Object.keys(process.env).length
        }
    });
};