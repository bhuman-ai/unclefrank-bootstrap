// FRANK'S BRANCH TRACKER - TRACK WHICH BRANCH TERRAGON IS WORKING ON

// FRANK'S REAL FIX: Use in-memory cache with fallback
// In serverless, each request might get a new instance, so we need a better approach
const globalBranchCache = global.branchCache || new Map();
global.branchCache = globalBranchCache;

const branchTracker = {
  // Get branches from cache
  loadBranches() {
    return globalBranchCache;
  },
  
  // Save branches to cache
  saveBranches(branches) {
    // Update global cache
    global.branchCache = branches;
    
    // Also log for debugging
    console.log('Current branch mappings:', [...branches.entries()].map(([k, v]) => 
      `${k} -> ${v.branch}`
    ).join(', '));
  },
  
  // Record a new branch for a thread
  recordBranch(threadId, branchName) {
    const branches = this.loadBranches();
    branches.set(threadId, {
      branch: branchName,
      timestamp: Date.now(),
      status: 'active'
    });
    this.saveBranches(branches);
    console.log(`Recorded branch ${branchName} for thread ${threadId}`);
  },
  
  // Get the branch for a thread
  getBranch(threadId) {
    const branches = this.loadBranches();
    
    // FRANK'S FALLBACK: Try to extract branch from thread ID if not found
    // Some Terragon threads include branch info in their IDs
    if (!branches.has(threadId) && threadId) {
      console.log(`No branch found for ${threadId}, checking for patterns...`);
      
      // Check if thread ID contains branch pattern
      // e.g., "terragon/setup-base-document-manager-hy0ltw" might be in the ID
      const branchPattern = /terragon\/[a-z0-9-]+/i;
      const match = threadId.match(branchPattern);
      if (match) {
        console.log(`Extracted branch from thread ID: ${match[0]}`);
        return {
          branch: match[0],
          timestamp: Date.now(),
          status: 'extracted'
        };
      }
    }
    const result = branches.get(threadId);
    console.log(`Branch lookup for ${threadId}: ${result ? result.branch : 'not found'}`);
    return result;
  },
  
  // Extract branch from Terragon's messages
  extractBranchFromMessage(message) {
    // FRANK'S SIMPLIFIED APPROACH - Terragon is explicit!
    // Just look for terragon/ branches
    const terragonBranchPattern = /terragon\/[\w-]+/;
    const match = message.match(terragonBranchPattern);
    
    if (match) {
      return match[0];
    }
    
    // Fallback: Look for explicit branch statements
    const explicitPatterns = [
      /creating branch[:\s]+([^\s]+)/i,
      /checkout -b ([^\s]+)/,
      /Working on branch[:\s]+([^\s]+)/i
    ];
    
    for (const pattern of explicitPatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
};

export default async function handler(req, res) {
  try {
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
  } catch (serverError) {
    // FRANK'S FAILSAFE: If anything goes wrong, return a safe response
    console.error('Branch tracker critical error:', serverError);
    return res.status(500).json({ 
      error: 'Branch tracker unavailable',
      branch: null
    });
  }
}