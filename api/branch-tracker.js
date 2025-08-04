// FRANK'S BRANCH TRACKER - TRACK WHICH BRANCH TERRAGON IS WORKING ON

const branchTracker = {
  // In-memory storage for branch tracking (would use DB in production)
  branches: new Map(),
  
  // Record a new branch for a thread
  recordBranch(threadId, branchName) {
    this.branches.set(threadId, {
      branch: branchName,
      timestamp: Date.now(),
      status: 'active'
    });
  },
  
  // Get the branch for a thread
  getBranch(threadId) {
    return this.branches.get(threadId);
  },
  
  // Extract branch from Terragon's messages
  extractBranchFromMessage(message) {
    // Look for branch creation patterns
    const patterns = [
      /creating branch[:\s]+([^\s]+)/i,
      /branch[:\s]+([^\s]+)/i,
      /checkout -b ([^\s]+)/,
      /switched to.*branch '([^']+)'/i,
      /terragon\/([^\s]+)/,
      /on branch[:\s]+([^\s]+)/i,
      /current branch[:\s]+([^\s]+)/i,
      /working on[:\s]+([^\s]+)/i,
      /pushed to[:\s]+([^\s]+)/i,
      /git push.*origin ([^\s]+)/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        // Clean up branch name
        let branch = match[1];
        // If it's just the suffix, add terragon/ prefix
        if (!branch.includes('/') && !branch.includes('master') && !branch.includes('main')) {
          branch = `terragon/${branch}`;
        }
        return branch;
      }
    }
    
    return null;
  }
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, threadId, branchName, message } = req.body;

  try {
    switch (action) {
      case 'record': {
        // Record a branch for a thread
        if (!threadId || !branchName) {
          return res.status(400).json({ error: 'Thread ID and branch name required' });
        }
        
        branchTracker.recordBranch(threadId, branchName);
        
        return res.status(200).json({
          threadId,
          branchName,
          status: 'recorded',
          timestamp: new Date().toISOString()
        });
      }
      
      case 'get': {
        // Get branch for a thread
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required' });
        }
        
        const branchInfo = branchTracker.getBranch(threadId);
        
        if (!branchInfo) {
          // Try to detect from message if provided
          if (message) {
            const detectedBranch = branchTracker.extractBranchFromMessage(message);
            if (detectedBranch) {
              branchTracker.recordBranch(threadId, detectedBranch);
              return res.status(200).json({
                threadId,
                branch: detectedBranch,
                source: 'detected',
                timestamp: new Date().toISOString()
              });
            }
          }
          
          return res.status(404).json({
            threadId,
            branch: null,
            message: 'No branch found for thread'
          });
        }
        
        return res.status(200).json({
          threadId,
          branch: branchInfo.branch,
          source: 'tracked',
          timestamp: new Date(branchInfo.timestamp).toISOString()
        });
      }
      
      case 'extract': {
        // Extract branch from message
        if (!message) {
          return res.status(400).json({ error: 'Message required' });
        }
        
        const branch = branchTracker.extractBranchFromMessage(message);
        
        return res.status(200).json({
          message: message.substring(0, 100) + '...',
          branch: branch,
          found: !!branch
        });
      }
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Branch Tracker Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}