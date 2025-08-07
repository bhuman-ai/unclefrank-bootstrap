import { NextApiRequest, NextApiResponse } from 'next';
import { draftPersistence } from '../../../src/db/draft-persistence';

/**
 * Draft Management API
 * Sacred Principle: Real database persistence, not file system
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Initialize schema on first use
    await draftPersistence.initializeSchema().catch(console.error);

    switch (req.method) {
        case 'GET':
            return handleGet(req, res);
        case 'POST':
            return handlePost(req, res);
        case 'PUT':
            return handlePut(req, res);
        case 'DELETE':
            return handleDelete(req, res);
        default:
            return res.status(405).json({ error: 'Method not allowed' });
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const { id, status, type, search } = req.query;

    try {
        if (id) {
            // Get single draft
            const draft = await draftPersistence.getDraft(id as string);
            if (!draft) {
                return res.status(404).json({ error: 'Draft not found' });
            }
            return res.status(200).json(draft);
        }

        if (status) {
            // Get drafts by status
            const drafts = await draftPersistence.getDraftsByStatus(status as string);
            return res.status(200).json(drafts);
        }

        if (type) {
            // Get drafts by type
            const drafts = await draftPersistence.getDraftsByType(type as string);
            return res.status(200).json(drafts);
        }

        if (search) {
            // Search drafts
            const drafts = await draftPersistence.searchDrafts(search as string);
            return res.status(200).json(drafts);
        }

        // Get all drafts (limited to recent)
        const drafts = await draftPersistence.getDraftsByStatus('draft');
        return res.status(200).json(drafts);
    } catch (error) {
        console.error('[Drafts API] GET error:', error);
        return res.status(500).json({ error: 'Failed to fetch drafts' });
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { title, content, type, status, metadata, created_by, parent_id } = req.body;

    if (!title || !content || !type) {
        return res.status(400).json({ error: 'Title, content, and type are required' });
    }

    try {
        const draft = await draftPersistence.createDraft({
            title,
            content,
            type,
            status: status || 'draft',
            metadata: metadata || {},
            created_by: created_by || 'system',
            version: 1,
            parent_id
        });

        console.log(`[Drafts API] Created draft: ${draft.id}`);
        return res.status(201).json(draft);
    } catch (error) {
        console.error('[Drafts API] POST error:', error);
        return res.status(500).json({ error: 'Failed to create draft' });
    }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Draft ID required' });
    }

    try {
        // Validate status transition if status is being changed
        if (req.body.status) {
            const validTransition = await draftPersistence.validateStatusTransition(
                id as string,
                req.body.status
            );
            
            if (!validTransition) {
                return res.status(400).json({ 
                    error: `Invalid status transition to ${req.body.status}` 
                });
            }
        }

        const updatedDraft = await draftPersistence.updateDraft(id as string, req.body);
        
        console.log(`[Drafts API] Updated draft: ${id}`);
        return res.status(200).json(updatedDraft);
    } catch (error) {
        console.error('[Drafts API] PUT error:', error);
        return res.status(500).json({ error: 'Failed to update draft' });
    }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Draft ID required' });
    }

    try {
        const deleted = await draftPersistence.deleteDraft(id as string);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Draft not found' });
        }
        
        console.log(`[Drafts API] Deleted draft: ${id}`);
        return res.status(204).end();
    } catch (error) {
        console.error('[Drafts API] DELETE error:', error);
        return res.status(500).json({ error: 'Failed to delete draft' });
    }
}