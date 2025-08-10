// AUTH MIDDLEWARE - Protect Frank's routes from unauthorized access
// Simple token-based auth for now, can be enhanced with OAuth later

const AUTH_TOKEN = process.env.FRANK_AUTH_TOKEN || 'frank-secret-token-change-this';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

// Public routes that don't need auth
const PUBLIC_ROUTES = [
    '/api/health',
    '/api/status'
];

// Read-only routes that need basic validation but not full auth
const READ_ONLY_ROUTES = [
    '/api/project-draft-manager?action=get-production',
    '/api/project-draft-manager?action=list',
    '/api/storage-manager?action=get-project'
];

module.exports = function authMiddleware(handler, options = {}) {
    return async function(req, res) {
        // CORS headers
        const origin = req.headers.origin || req.headers.referer || '*';
        if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        // Check if route is public
        const routePath = req.url?.split('?')[0];
        const fullPath = req.url;
        
        if (PUBLIC_ROUTES.includes(routePath)) {
            return handler(req, res);
        }
        
        // Check if route is read-only
        if (READ_ONLY_ROUTES.some(route => fullPath?.includes(route))) {
            // Read-only routes are allowed without auth for now
            // In production, might want to add rate limiting
            return handler(req, res);
        }
        
        // Check for auth token
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        // For write operations, require auth
        const isWriteOperation = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
        const isDraftCreation = fullPath?.includes('action=create');
        const isTaskExecution = fullPath?.includes('action=execute');
        const isMerge = fullPath?.includes('action=merge');
        
        if (isWriteOperation || isDraftCreation || isTaskExecution || isMerge) {
            // Check token
            if (!token || token !== AUTH_TOKEN) {
                // Allow localhost in development
                const isLocalhost = req.headers.host?.includes('localhost');
                const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
                
                if (!isLocalhost || !isDevelopment) {
                    return res.status(401).json({
                        error: 'Unauthorized',
                        message: 'Authentication required for this operation',
                        frank: "You trying to pull something? Get proper authorization first."
                    });
                }
            }
        }
        
        // Add user context to request
        req.user = {
            authenticated: token === AUTH_TOKEN,
            role: token === AUTH_TOKEN ? 'admin' : 'guest',
            timestamp: new Date().toISOString()
        };
        
        // Log access for audit
        if (isWriteOperation) {
            console.log(`[Auth] ${req.method} ${req.url} by ${req.user.role} at ${req.user.timestamp}`);
        }
        
        // Call the actual handler
        return handler(req, res);
    };
};

// Helper to check if request has valid auth
module.exports.isAuthenticated = function(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    return token === AUTH_TOKEN;
};

// Helper to get user from request
module.exports.getUser = function(req) {
    return req.user || { authenticated: false, role: 'guest' };
};