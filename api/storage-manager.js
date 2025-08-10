// STORAGE MANAGER - Cloud storage for drafts and state
// Uses Vercel Blob Storage or fallback to temporary storage

const { put, get, list, del } = process.env.BLOB_READ_WRITE_TOKEN ? 
    require('@vercel/blob') : 
    require('./storage-fallback');

// Storage keys
const KEYS = {
    DRAFTS: 'drafts',
    PROJECT_MD: 'project-md',
    STATE: 'workspace-state',
    TASKS: 'tasks'
};

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'save-draft':
                return await saveDraft(req, res);
            case 'get-draft':
                return await getDraft(req, res);
            case 'list-drafts':
                return await listDrafts(req, res);
            case 'delete-draft':
                return await deleteDraft(req, res);
            case 'save-state':
                return await saveState(req, res);
            case 'get-state':
                return await getState(req, res);
            case 'save-project':
                return await saveProjectMd(req, res);
            case 'get-project':
                return await getProjectMd(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Storage Manager error:', error);
        return res.status(500).json({ 
            error: 'Storage operation failed',
            details: error.message,
            usingFallback: !process.env.BLOB_READ_WRITE_TOKEN
        });
    }
};

// Save draft to cloud storage
async function saveDraft(req, res) {
    const { draftId, content, metadata } = req.body;
    
    if (!draftId || !content) {
        return res.status(400).json({ error: 'Missing draftId or content' });
    }
    
    try {
        // Store draft content
        const contentBlob = await put(`${KEYS.DRAFTS}/${draftId}/content.md`, content, {
            access: 'public',
            contentType: 'text/markdown'
        });
        
        // Store metadata
        const metadataBlob = await put(`${KEYS.DRAFTS}/${draftId}/metadata.json`, JSON.stringify(metadata || {}), {
            access: 'public',
            contentType: 'application/json'
        });
        
        return res.status(200).json({
            success: true,
            draftId,
            contentUrl: contentBlob.url,
            metadataUrl: metadataBlob.url,
            storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'fallback'
        });
    } catch (error) {
        console.error('Failed to save draft:', error);
        return res.status(500).json({ 
            error: 'Failed to save draft',
            details: error.message 
        });
    }
}

// Get draft from cloud storage
async function getDraft(req, res) {
    const { draftId } = req.query;
    
    if (!draftId) {
        return res.status(400).json({ error: 'Missing draftId' });
    }
    
    try {
        // Get draft content
        const contentBlob = await get(`${KEYS.DRAFTS}/${draftId}/content.md`);
        const content = await contentBlob.text();
        
        // Get metadata
        let metadata = {};
        try {
            const metadataBlob = await get(`${KEYS.DRAFTS}/${draftId}/metadata.json`);
            metadata = await metadataBlob.json();
        } catch (e) {
            // Metadata might not exist
        }
        
        return res.status(200).json({
            success: true,
            draftId,
            content,
            metadata,
            storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'fallback'
        });
    } catch (error) {
        return res.status(404).json({ 
            error: 'Draft not found',
            draftId 
        });
    }
}

// List all drafts
async function listDrafts(req, res) {
    try {
        const blobs = await list({
            prefix: `${KEYS.DRAFTS}/`
        });
        
        // Extract unique draft IDs
        const draftIds = new Set();
        for (const blob of blobs.blobs) {
            const match = blob.pathname.match(/drafts\/([^\/]+)\//);
            if (match) {
                draftIds.add(match[1]);
            }
        }
        
        return res.status(200).json({
            success: true,
            drafts: Array.from(draftIds),
            count: draftIds.size,
            storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'fallback'
        });
    } catch (error) {
        return res.status(500).json({ 
            error: 'Failed to list drafts',
            details: error.message 
        });
    }
}

// Delete draft
async function deleteDraft(req, res) {
    const { draftId } = req.body;
    
    if (!draftId) {
        return res.status(400).json({ error: 'Missing draftId' });
    }
    
    try {
        // Delete content and metadata
        await del([
            `${KEYS.DRAFTS}/${draftId}/content.md`,
            `${KEYS.DRAFTS}/${draftId}/metadata.json`
        ]);
        
        return res.status(200).json({
            success: true,
            draftId,
            message: 'Draft deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({ 
            error: 'Failed to delete draft',
            details: error.message 
        });
    }
}

// Save workspace state
async function saveState(req, res) {
    const { state } = req.body;
    
    if (!state) {
        return res.status(400).json({ error: 'Missing state' });
    }
    
    try {
        const stateBlob = await put(`${KEYS.STATE}/current.json`, JSON.stringify(state), {
            access: 'public',
            contentType: 'application/json'
        });
        
        return res.status(200).json({
            success: true,
            stateUrl: stateBlob.url,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({ 
            error: 'Failed to save state',
            details: error.message 
        });
    }
}

// Get workspace state
async function getState(req, res) {
    try {
        const stateBlob = await get(`${KEYS.STATE}/current.json`);
        const state = await stateBlob.json();
        
        return res.status(200).json({
            success: true,
            state,
            storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'fallback'
        });
    } catch (error) {
        // No saved state, return empty
        return res.status(200).json({
            success: true,
            state: {},
            message: 'No saved state found'
        });
    }
}

// Save Project.md to cloud
async function saveProjectMd(req, res) {
    const { content } = req.body;
    
    if (!content) {
        return res.status(400).json({ error: 'Missing content' });
    }
    
    try {
        const projectBlob = await put(`${KEYS.PROJECT_MD}/current.md`, content, {
            access: 'public',
            contentType: 'text/markdown'
        });
        
        // Also save a backup with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await put(`${KEYS.PROJECT_MD}/backups/${timestamp}.md`, content, {
            access: 'public',
            contentType: 'text/markdown'
        });
        
        return res.status(200).json({
            success: true,
            url: projectBlob.url,
            timestamp,
            message: 'Project.md saved successfully'
        });
    } catch (error) {
        return res.status(500).json({ 
            error: 'Failed to save Project.md',
            details: error.message 
        });
    }
}

// Get Project.md from cloud
async function getProjectMd(req, res) {
    try {
        const projectBlob = await get(`${KEYS.PROJECT_MD}/current.md`);
        const content = await projectBlob.text();
        
        return res.status(200).json({
            success: true,
            content,
            storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'fallback'
        });
    } catch (error) {
        // Return default content if not found
        const defaultContent = `# Project.md

This is the production Project.md. Edit to make changes.

## Status
- System deployed on Vercel
- Storage: ${process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : 'Temporary'}

## Next Steps
1. Edit this document
2. System will detect changes
3. Tasks will be generated automatically
4. Execute with one click`;
        
        return res.status(200).json({
            success: true,
            content: defaultContent,
            message: 'Using default content'
        });
    }
}