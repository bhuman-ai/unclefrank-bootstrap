export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Basic document manager endpoint
        res.status(200).json({
            message: 'Document Manager API is working',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Document Manager API Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}