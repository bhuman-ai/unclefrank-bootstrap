import { NextApiRequest, NextApiResponse } from 'next';
import { githubDraftStorage } from '../../../cli/src/api/github-draft-storage';

/**
 * GitHub Draft API - The REAL draft storage
 * No database needed - GitHub IS the database
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
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
    const { status } = req.query;
    
    try {
        const drafts = await githubDraftStorage.getDrafts(status as string);
        return res.status(200).json({
            success: true,
            drafts,
            count: drafts.length
        });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[GitHub Drafts] GET error:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { title, content, type } = req.body;
    
    if (!title || !content || !type) {
        return res.status(400).json({ 
            success: false,
            error: 'Title, content, and type are required' 
        });
    }
    
    try {
        const draft = await githubDraftStorage.createDraft(title, content, type);
        console.log(`[GitHub Drafts] Created draft #${draft.issueNumber}`);
        
        return res.status(201).json({
            success: true,
            draft,
            message: `Draft created as GitHub Issue #${draft.issueNumber}`
        });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[GitHub Drafts] POST error:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
    const { issueNumber, status, convertToPR } = req.body;
    
    if (!issueNumber) {
        return res.status(400).json({ 
            success: false,
            error: 'Issue number required' 
        });
    }
    
    try {
        if (convertToPR && status === 'approved') {
            // Convert approved draft to PR
            const prNumber = await githubDraftStorage.convertDraftToPR(issueNumber);
            return res.status(200).json({
                success: true,
                prNumber,
                message: `Draft converted to PR #${prNumber}`
            });
        } else if (status) {
            // Just update status
            const draft = await githubDraftStorage.updateDraftStatus(issueNumber, status);
            return res.status(200).json({
                success: true,
                draft,
                message: `Draft status updated to ${status}`
            });
        } else {
            return res.status(400).json({ 
                success: false,
                error: 'Status or convertToPR required' 
            });
        }
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[GitHub Drafts] PUT error:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { issueNumber } = req.query;
    
    if (!issueNumber) {
        return res.status(400).json({ 
            success: false,
            error: 'Issue number required' 
        });
    }
    
    try {
        const deleted = await githubDraftStorage.deleteDraft(parseInt(issueNumber as string));
        
        if (deleted) {
            return res.status(204).end();
        } else {
            return res.status(404).json({ 
                success: false,
                error: 'Draft not found' 
            });
        }
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[GitHub Drafts] DELETE error:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
}