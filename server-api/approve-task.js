// HUMAN APPROVAL HANDLER - Merges PR and deploys to production
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { taskId, issueNumber, sessionId, prNumber, branchName } = req.body;
    
    if (!issueNumber && !prNumber && !branchName) {
        return res.status(400).json({ 
            error: 'Need either issueNumber, prNumber, or branchName to approve task' 
        });
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured' });
    }
    
    try {
        let pullRequestNumber = prNumber;
        let branch = branchName;
        
        // Step 1: Find the PR if we don't have it
        if (!pullRequestNumber && issueNumber) {
            // Get issue to find linked PR
            const issue = await githubRequest(`/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`);
            
            // Look for PR in issue body or comments
            const prMatch = issue.body?.match(/PR: https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/(\d+)/);
            if (prMatch) {
                pullRequestNumber = prMatch[1];
            }
        }
        
        // If still no PR, try to find by branch
        if (!pullRequestNumber && (branch || sessionId)) {
            if (!branch && sessionId) {
                branch = `claude-session-${sessionId}`;
            }
            
            // Find PR by branch
            const prs = await githubRequest(`/repos/bhuman-ai/unclefrank-bootstrap/pulls?head=bhuman-ai:${branch}&state=open`);
            if (prs && prs.length > 0) {
                pullRequestNumber = prs[0].number;
            }
        }
        
        if (!pullRequestNumber) {
            return res.status(404).json({ 
                error: 'No pull request found for this task',
                searched: { issueNumber, prNumber, branchName, sessionId }
            });
        }
        
        // Step 2: Approve the PR
        console.log(`Approving PR #${pullRequestNumber}...`);
        await githubRequest(
            `/repos/bhuman-ai/unclefrank-bootstrap/pulls/${pullRequestNumber}/reviews`,
            'POST',
            {
                body: '✅ Approved by human review',
                event: 'APPROVE'
            }
        );
        
        // Step 3: Merge the PR
        console.log(`Merging PR #${pullRequestNumber}...`);
        const mergeResult = await githubRequest(
            `/repos/bhuman-ai/unclefrank-bootstrap/pulls/${pullRequestNumber}/merge`,
            'PUT',
            {
                commit_title: `Merge PR #${pullRequestNumber}: Human approved`,
                commit_message: '✅ Task completed and approved by human review\n\n🤖 Auto-merged by approval system',
                merge_method: 'squash' // or 'merge' or 'rebase'
            }
        );
        
        if (!mergeResult.merged && mergeResult.message) {
            throw new Error(`Failed to merge: ${mergeResult.message}`);
        }
        
        // Step 4: Update GitHub issue
        if (issueNumber) {
            console.log(`Updating issue #${issueNumber}...`);
            
            // Add completed label and close issue
            await githubRequest(
                `/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`,
                'PATCH',
                {
                    state: 'closed',
                    labels: ['completed', 'human-approved']
                }
            );
            
            // Add final comment
            await githubRequest(
                `/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}/comments`,
                'POST',
                {
                    body: `## ✅ Task Completed and Deployed\n\n**PR #${pullRequestNumber}** has been merged to master.\n\n### Deployment Status:\n- 🚀 Vercel: Auto-deploying to production\n- ✅ GitHub: Issue closed\n- 🎯 Status: Human approved and merged\n\n**Live URL:** https://unclefrank-bootstrap.vercel.app`
                }
            );
        }
        
        // Step 5: Delete the branch (cleanup)
        if (branch) {
            console.log(`Cleaning up branch ${branch}...`);
            try {
                await githubRequest(
                    `/repos/bhuman-ai/unclefrank-bootstrap/git/refs/heads/${branch}`,
                    'DELETE'
                );
            } catch (e) {
                console.log('Branch cleanup failed (might already be deleted):', e.message);
            }
        }
        
        return res.status(200).json({
            success: true,
            message: 'Task approved and merged successfully',
            details: {
                prNumber: pullRequestNumber,
                merged: true,
                issueNumber: issueNumber,
                issueClosed: true,
                branchDeleted: true,
                deploymentStatus: 'Vercel auto-deploying from master'
            }
        });
        
    } catch (error) {
        console.error('Approval error:', error);
        return res.status(500).json({ 
            error: 'Failed to approve task',
            details: error.message 
        });
    }
}

// Helper function for GitHub API requests
async function githubRequest(endpoint, method = 'GET', body = null) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'UncleFrank-ApprovalSystem',
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(`GitHub API error: ${res.statusCode} - ${parsed.message || data}`));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    if (res.statusCode >= 400) {
                        reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
                    } else {
                        resolve(data);
                    }
                }
            });
        });
        
        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}