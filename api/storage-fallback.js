// STORAGE FALLBACK - In-memory storage when Vercel Blob is not available
// This is temporary and will be lost on restart

const storage = new Map();

// Simulate Vercel Blob API
module.exports = {
    async put(key, content, options = {}) {
        storage.set(key, {
            content,
            contentType: options.contentType || 'text/plain',
            timestamp: new Date().toISOString()
        });
        
        return {
            url: `memory://${key}`,
            pathname: key
        };
    },
    
    async get(key) {
        const item = storage.get(key);
        if (!item) {
            throw new Error(`Key not found: ${key}`);
        }
        
        return {
            async text() {
                return typeof item.content === 'string' ? 
                    item.content : 
                    JSON.stringify(item.content);
            },
            async json() {
                return typeof item.content === 'string' ? 
                    JSON.parse(item.content) : 
                    item.content;
            },
            contentType: item.contentType
        };
    },
    
    async list(options = {}) {
        const prefix = options.prefix || '';
        const blobs = [];
        
        for (const [key, value] of storage.entries()) {
            if (key.startsWith(prefix)) {
                blobs.push({
                    pathname: key,
                    contentType: value.contentType,
                    size: value.content.length,
                    uploadedAt: value.timestamp
                });
            }
        }
        
        return { blobs };
    },
    
    async del(keys) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keysArray) {
            storage.delete(key);
        }
    }
};

// Log that we're using fallback
console.log('[Storage] Using in-memory fallback storage (no BLOB_READ_WRITE_TOKEN found)');
console.log('[Storage] Data will be lost on restart. Configure Vercel Blob for persistence.');