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
    
    const { method, endpoint, body, action, issueNumber, newSessionId, oldSessionId, checkpoints } = req.body || {};
    
    // Handle special action for updating issue with checkpoints
    if (action === 'update-issue-checkpoints' && issueNumber && checkpoints) {
        try {
            // First, get the current issue
            const getUrl = `https://api.github.com/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`;
            const getOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UncleFrank-Bootstrap'
                }
            };
            
            const issueData = await new Promise((resolve, reject) => {
                https.get(getUrl, getOptions, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });
            
            // Update the body with checkpoints
            let updatedBody = issueData.body || '';
            
            // Format checkpoints for GitHub
            let checkpointText = '\n\n## Checkpoints\n';
            checkpoints.forEach(cp => {
                checkpointText += `\n### ☐ Checkpoint ${cp.id}: ${cp.name}\n`;
                if (cp.objective) checkpointText += `- **Objective:** ${cp.objective}\n`;
                if (cp.deliverables) checkpointText += `- **Deliverables:** ${cp.deliverables}\n`;
                if (cp.passCriteria) checkpointText += `- **Pass Criteria:** ${cp.passCriteria}\n`;
            });
            
            // Remove old checkpoints section if exists
            const checkpointPattern = /\n\n## Checkpoints[\s\S]*?(?=\n\n##|$)/;
            if (checkpointPattern.test(updatedBody)) {
                updatedBody = updatedBody.replace(checkpointPattern, checkpointText);
            } else {
                updatedBody += checkpointText;
            }
            
            // Update the issue
            const updateUrl = `https://api.github.com/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`;
            const updateOptions = {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'UncleFrank-Bootstrap'
                }
            };
            
            const result = await new Promise((resolve, reject) => {
                const req = https.request(updateUrl, updateOptions, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                req.on('error', reject);
                req.write(JSON.stringify({ body: updatedBody }));
                req.end();
            });
            
            if (result.status >= 200 && result.status < 300) {
                console.log(`Updated GitHub issue #${issueNumber} with ${checkpoints.length} checkpoints`);
                return res.status(200).json({ success: true, issueNumber, checkpoints: checkpoints.length });
            } else {
                console.error('Failed to update issue:', result);
                return res.status(result.status).json(result.data);
            }
        } catch (error) {
            console.error('Error updating issue checkpoints:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    // Handle special action for updating issue session
    if (action === 'update-issue-session' && issueNumber && newSessionId) {
        try {
            // First, get the current issue
            const getUrl = `https://api.github.com/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`;
            const getOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UncleFrank-Bootstrap'
                }
            };
            
            const issueData = await new Promise((resolve, reject) => {
                https.get(getUrl, getOptions, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });
            
            // Update the body with new session ID
            let updatedBody = issueData.body || '';
            const sessionPattern = /Claude Session: [a-f0-9-]+/;
            if (sessionPattern.test(updatedBody)) {
                updatedBody = updatedBody.replace(sessionPattern, `Claude Session: ${newSessionId}`);
            } else {
                // Add session ID if not present
                updatedBody += `\n- Claude Session: ${newSessionId}`;
            }
            
            // Update the issue
            const updateUrl = `https://api.github.com/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`;
            const updateOptions = {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'UncleFrank-Bootstrap'
                }
            };
            
            const result = await new Promise((resolve, reject) => {
                const req = https.request(updateUrl, updateOptions, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                req.on('error', reject);
                req.write(JSON.stringify({ body: updatedBody }));
                req.end();
            });
            
            if (result.status >= 200 && result.status < 300) {
                console.log(`Updated GitHub issue #${issueNumber} with new session ${newSessionId}`);
                return res.status(200).json({ success: true, issueNumber, newSessionId });
            } else {
                console.error('Failed to update issue:', result);
                return res.status(result.status).json(result.data);
            }
        } catch (error) {
            console.error('Error updating issue session:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    // Handle special action for updating issue status to ready for review
    if (action === 'update-issue-status' && issueNumber) {
        try {
            const { status, sessionId, testingInstructions } = req.body;
            
            // First, get the current issue
            const getUrl = `https://api.github.com/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`;
            const getOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UncleFrank-Bootstrap'
                }
            };
            
            const issueData = await new Promise((resolve, reject) => {
                https.get(getUrl, getOptions, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
            });
            
            // Build the status update section
            let statusSection = '\n\n---\n\n## 🎯 TASK STATUS: READY FOR HUMAN REVIEW\n\n';
            statusSection += `**Session ID:** ${sessionId}\n`;
            statusSection += `**Status:** Ready for Human Review\n`;
            statusSection += `**Updated:** ${new Date().toISOString()}\n\n`;
            
            if (testingInstructions) {
                statusSection += '### Human Testing Instructions:\n';
                statusSection += testingInstructions + '\n\n';
            }
            
            statusSection += '### Review Actions:\n';
            statusSection += '- [ ] Review all checkpoint implementations\n';
            statusSection += '- [ ] Test the sacred flow enforcement\n';
            statusSection += '- [ ] Verify all pass criteria are met\n';
            statusSection += '- [ ] Run integration tests\n';
            statusSection += '- [ ] Approve or request changes\n';
            
            // Update the issue body with status
            let updatedBody = issueData.body || '';
            
            // Remove old status section if it exists
            const statusRegex = /\n\n---\n\n## 🎯 TASK STATUS:.*$/s;
            updatedBody = updatedBody.replace(statusRegex, '');
            
            // Add new status section
            updatedBody += statusSection;
            
            // Update the issue
            const updateUrl = `https://api.github.com/repos/bhuman-ai/unclefrank-bootstrap/issues/${issueNumber}`;
            const updateBody = JSON.stringify({
                body: updatedBody,
                labels: [...(issueData.labels?.map(l => l.name) || []), 'ready-for-review']
            });
            
            const result = await new Promise((resolve, reject) => {
                const req = https.request(updateUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'UncleFrank-Bootstrap',
                        'Content-Length': Buffer.byteLength(updateBody)
                    }
                }, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                
                req.on('error', reject);
                req.write(updateBody);
                req.end();
            });
            
            if (result.status >= 200 && result.status < 300) {
                console.log(`Updated GitHub issue #${issueNumber} to ready for review`);
                return res.status(200).json({ success: true, issueNumber, status: 'ready_for_review' });
            } else {
                console.error('Failed to update issue:', result);
                return res.status(result.status).json(result.data);
            }
        } catch (error) {
            console.error('Error updating issue status:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
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