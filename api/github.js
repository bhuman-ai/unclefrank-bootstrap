const https = require('https');

module.exports = async (req, res) => {
    // Enable CORS for the frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    
    if (!GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN not found in environment variables');
        return res.status(500).json({ error: 'GitHub token not configured' });
    }
    
    const { method, endpoint, body } = req.body || {};
    
    if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint required' });
    }
    
    try {
        const url = `https://api.github.com${endpoint}`;
        
        // Use https module instead of fetch for Node.js compatibility
        const options = {
            method: method || 'GET',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'UncleFrank-Bootstrap'
            }
        };
        
        const result = await new Promise((resolve, reject) => {
            const req = https.request(url, options, (response) => {
                let data = '';
                
                response.on('data', chunk => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: response.statusCode, data: parsed });
                    } catch (e) {
                        reject(new Error('Failed to parse GitHub response'));
                    }
                });
            });
            
            req.on('error', reject);
            
            if (body) {
                req.write(JSON.stringify(body));
            }
            
            req.end();
        });
        
        if (result.status >= 400) {
            console.error('GitHub API error response:', result.status, result.data);
            return res.status(result.status).json(result.data);
        }
        
        return res.status(200).json(result.data);
    } catch (error) {
        console.error('GitHub API error:', error);
        return res.status(500).json({ error: error.message });
    }
};