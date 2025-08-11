// BASIC AUTHENTICATION - Simple token-based auth
// In production, use proper authentication service

const crypto = require('crypto');

// Store sessions in memory (use database in production)
const sessions = new Map();

// Admin token from environment (set this in Vercel)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'frank-admin-token-change-this';

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'login':
                return await handleLogin(req, res);
            case 'verify':
                return await verifySession(req, res);
            case 'logout':
                return await handleLogout(req, res);
            case 'check':
                return await checkAuth(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ 
            error: 'Authentication failed',
            details: error.message 
        });
    }
};

// Handle login
async function handleLogin(req, res) {
    const { token, username = 'user' } = req.body;
    
    // Check if token matches admin token
    if (token !== ADMIN_TOKEN) {
        return res.status(401).json({ 
            error: 'Invalid token',
            message: 'Check ADMIN_TOKEN environment variable' 
        });
    }
    
    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionData = {
        username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        permissions: ['read', 'write', 'execute']
    };
    
    sessions.set(sessionToken, sessionData);
    
    return res.status(200).json({
        success: true,
        sessionToken,
        username,
        expiresAt: sessionData.expiresAt,
        message: 'Login successful'
    });
}

// Verify session
async function verifySession(req, res) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'No authorization header',
            authenticated: false 
        });
    }
    
    const sessionToken = authHeader.substring(7);
    const sessionData = sessions.get(sessionToken);
    
    if (!sessionData) {
        return res.status(401).json({ 
            error: 'Invalid session',
            authenticated: false 
        });
    }
    
    // Check if expired
    if (new Date(sessionData.expiresAt) < new Date()) {
        sessions.delete(sessionToken);
        return res.status(401).json({ 
            error: 'Session expired',
            authenticated: false 
        });
    }
    
    return res.status(200).json({
        authenticated: true,
        username: sessionData.username,
        permissions: sessionData.permissions,
        expiresAt: sessionData.expiresAt
    });
}

// Handle logout
async function handleLogout(req, res) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        sessions.delete(sessionToken);
    }
    
    return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
}

// Check if authentication is enabled
async function checkAuth(req, res) {
    const authEnabled = process.env.REQUIRE_AUTH === 'true';
    
    return res.status(200).json({
        authEnabled,
        authType: 'token',
        message: authEnabled ? 
            'Authentication required. Set ADMIN_TOKEN in environment.' : 
            'Authentication disabled. Set REQUIRE_AUTH=true to enable.'
    });
}

// Middleware function to protect routes
function requireAuth(handler) {
    return async (req, res) => {
        // Skip auth if not enabled
        if (process.env.REQUIRE_AUTH !== 'true') {
            return handler(req, res);
        }
        
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Include Authorization: Bearer <token> header' 
            });
        }
        
        const sessionToken = authHeader.substring(7);
        const sessionData = sessions.get(sessionToken);
        
        if (!sessionData || new Date(sessionData.expiresAt) < new Date()) {
            return res.status(401).json({ 
                error: 'Invalid or expired session',
                message: 'Please login again' 
            });
        }
        
        // Add user info to request
        req.user = sessionData;
        
        return handler(req, res);
    };
}

module.exports.requireAuth = requireAuth;