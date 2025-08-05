// FRANK'S CLAUDE HEALTH MONITOR
// Proactive monitoring and auto-restart for Claude executor

const https = require('https');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { action } = req.body;
  const CLAUDE_EXECUTOR_URL = process.env.CLAUDE_EXECUTOR_URL || 'https://uncle-frank-claude.fly.dev';
  
  console.log('[Claude Monitor] Action:', action);
  
  try {
    switch (action) {
      case 'ensure-running': {
        // Check if Claude is running
        let isHealthy = false;
        try {
          isHealthy = await checkHealth(CLAUDE_EXECUTOR_URL);
        } catch (error) {
          isHealthy = false;
        }
        
        if (!isHealthy) {
          console.log('[Claude Monitor] Service is down, triggering restart...');
          
          // Trigger fly.io restart
          const restartResult = await triggerRestart();
          if (restartResult.success) {
            return res.status(200).json({
              success: true,
              restarted: true,
              message: 'Claude executor restart initiated',
              ...restartResult
            });
          }
        }
        
        return res.status(200).json({
          success: true,
          healthy: isHealthy,
          message: isHealthy ? 'Claude executor is running' : 'Claude executor is down'
        });
      }
      
      case 'force-restart': {
        console.log('[Claude Monitor] Force restart requested');
        // Force a restart regardless of health
        const restartResult = await triggerRestart();
        
        if (restartResult.success) {
          return res.status(200).json({
            success: true,
            message: 'Force restart initiated',
            ...restartResult
          });
        } else {
          return res.status(500).json({
            success: false,
            error: 'Failed to restart',
            details: restartResult.error
          });
        }
      }
      
      default:
        console.log('[Claude Monitor] Unknown action:', action);
        return res.status(400).json({ error: 'Unknown action', received: action });
    }
  } catch (error) {
    console.error('[Claude Monitor] Error:', error);
    return res.status(500).json({
      error: 'Monitor error',
      details: error.message
    });
  }
};

// Check if Claude executor is healthy
function checkHealth(url) {
  return new Promise((resolve) => {
    const healthUrl = new URL(url);
    const options = {
      hostname: healthUrl.hostname,
      path: '/health',
      method: 'GET',
      timeout: 3000
    };
    
    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Trigger fly.io restart
async function triggerRestart() {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://unclefrank-bootstrap.vercel.app';
    
  console.log('[Claude Monitor] Calling flyio-manager at:', baseUrl);
  
  return new Promise((resolve) => {
    const url = new URL(`${baseUrl}/api/flyio-manager`);
    const postData = JSON.stringify({ action: 'restart' });
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('[Claude Monitor] Restart result:', result);
          resolve({ success: res.statusCode === 200, ...result });
        } catch (e) {
          console.error('[Claude Monitor] Failed to parse restart response:', e);
          resolve({ success: false, error: 'Invalid response from flyio-manager' });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('[Claude Monitor] Restart request failed:', error);
      resolve({ success: false, error: error.message });
    });
    
    req.write(postData);
    req.end();
  });
}