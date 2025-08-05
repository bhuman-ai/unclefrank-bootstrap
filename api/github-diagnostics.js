module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    // Test the token by making a simple API call
    let tokenWorks = false;
    let apiError = null;
    
    if (GITHUB_TOKEN) {
        try {
            const https = require('https');
            const testResult = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api.github.com',
                    path: '/user',
                    method: 'GET',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'UncleFrank-Bootstrap'
                    }
                };
                
                const req = https.request(options, (response) => {
                    let data = '';
                    response.on('data', chunk => { data += chunk; });
                    response.on('end', () => {
                        if (response.statusCode === 200) {
                            resolve({ success: true, data: JSON.parse(data) });
                        } else {
                            resolve({ success: false, status: response.statusCode, error: data });
                        }
                    });
                });
                
                req.on('error', (e) => {
                    resolve({ success: false, error: e.message });
                });
                
                req.end();
            });
            
            tokenWorks = testResult.success;
            apiError = testResult.error;
        } catch (e) {
            apiError = e.message;
        }
    }
    
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
        tokenTest: {
            works: tokenWorks,
            error: apiError
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
        }
    });
};