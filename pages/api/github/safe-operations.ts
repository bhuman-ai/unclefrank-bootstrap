import { NextApiRequest, NextApiResponse } from 'next';
import { githubErrorHandler } from '../../../src/api/github-error-handler';

/**
 * Safe GitHub Operations API
 * Sacred Principle: Never let GitHub failures crash the system
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { operation } = req.body;

    if (!operation) {
        return res.status(400).json({ error: 'Operation required' });
    }

    try {
        switch (operation) {
            case 'check-connectivity':
                return await handleConnectivityCheck(req, res);
                
            case 'create-file':
                return await handleCreateFile(req, res);
                
            case 'create-issue':
                return await handleCreateIssue(req, res);
                
            case 'create-pr':
                return await handleCreatePR(req, res);
                
            default:
                return res.status(400).json({ error: 'Unknown operation' });
        }
    } catch (error) {
        console.error('[GitHub Safe Operations] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Operation failed'
        });
    }
}

async function handleConnectivityCheck(req: NextApiRequest, res: NextApiResponse) {
    console.log('[GitHub] Checking connectivity...');
    
    const status = await githubErrorHandler.checkConnectivity();
    
    if (status.connected) {
        console.log('✅ GitHub connected');
        return res.status(200).json({
            success: true,
            ...status
        });
    } else {
        console.log('❌ GitHub connection failed');
        return res.status(503).json({
            success: false,
            ...status
        });
    }
}

async function handleCreateFile(req: NextApiRequest, res: NextApiResponse) {
    const {
        owner = process.env.GITHUB_USER || 'bhuman-ai',
        repo = process.env.GITHUB_REPO?.split('/')[1] || 'unclefrank-bootstrap',
        path,
        content,
        message,
        branch = 'main'
    } = req.body;

    if (!path || !content || !message) {
        return res.status(400).json({ 
            error: 'Path, content, and message required' 
        });
    }

    console.log(`[GitHub] Creating/updating file: ${path}`);
    
    const success = await githubErrorHandler.createOrUpdateFile(
        owner,
        repo,
        path,
        content,
        message,
        branch
    );
    
    if (success) {
        console.log(`✅ File operation succeeded: ${path}`);
        return res.status(200).json({
            success: true,
            path,
            message: 'File created/updated successfully'
        });
    } else {
        console.log(`❌ File operation failed: ${path}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to create/update file',
            fallback: 'File may have been saved locally'
        });
    }
}

async function handleCreateIssue(req: NextApiRequest, res: NextApiResponse) {
    const {
        owner = process.env.GITHUB_USER || 'bhuman-ai',
        repo = process.env.GITHUB_REPO?.split('/')[1] || 'unclefrank-bootstrap',
        title,
        body,
        labels = []
    } = req.body;

    if (!title || !body) {
        return res.status(400).json({ 
            error: 'Title and body required' 
        });
    }

    console.log(`[GitHub] Creating issue: ${title}`);
    
    const issueNumber = await githubErrorHandler.createIssue(
        owner,
        repo,
        title,
        body,
        labels
    );
    
    if (issueNumber !== null) {
        const isLocal = issueNumber < 0;
        console.log(`✅ Issue created: ${isLocal ? 'locally' : `#${issueNumber}`}`);
        
        return res.status(200).json({
            success: true,
            issueNumber,
            local: isLocal,
            message: isLocal ? 
                'Issue saved locally due to GitHub unavailability' : 
                `Issue #${issueNumber} created successfully`
        });
    } else {
        console.log(`❌ Issue creation failed: ${title}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to create issue'
        });
    }
}

async function handleCreatePR(req: NextApiRequest, res: NextApiResponse) {
    const {
        owner = process.env.GITHUB_USER || 'bhuman-ai',
        repo = process.env.GITHUB_REPO?.split('/')[1] || 'unclefrank-bootstrap',
        title,
        head,
        base = 'main',
        body
    } = req.body;

    if (!title || !head || !body) {
        return res.status(400).json({ 
            error: 'Title, head branch, and body required' 
        });
    }

    console.log(`[GitHub] Creating PR: ${title}`);
    
    const prNumber = await githubErrorHandler.createPullRequest(
        owner,
        repo,
        title,
        head,
        base,
        body
    );
    
    if (prNumber !== null) {
        const isIssue = prNumber < 0;
        console.log(`✅ ${isIssue ? 'Issue' : 'PR'} created: ${Math.abs(prNumber)}`);
        
        return res.status(200).json({
            success: true,
            number: prNumber,
            fallback: isIssue,
            message: isIssue ? 
                'Created issue instead of PR due to GitHub limitations' : 
                `Pull Request #${prNumber} created successfully`
        });
    } else {
        console.log(`❌ PR creation failed: ${title}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to create pull request'
        });
    }
}