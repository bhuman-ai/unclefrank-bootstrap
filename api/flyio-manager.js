// FRANK'S FLY.IO RESILIENCE MANAGER
// Auto-restarts fly.io services when they're down
// No more manual intervention BS!

const https = require('https');

// Circuit breaker to prevent restart spam
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  resetTimeout: 5 * 60 * 1000, // 5 minutes
  maxFailures: 3
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { action } = req.body;
  const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  const CLAUDE_APP_NAME = process.env.CLAUDE_FLY_APP_NAME || 'uncle-frank-claude';
  
  if (!FLY_API_TOKEN) {
    return res.status(500).json({
      error: 'FLY_API_TOKEN not configured',
      solution: 'Add FLY_API_TOKEN to Vercel environment variables'
    });
  }
  
  try {
    switch (action) {
      case 'check-health': {
        // Check if app is running
        const status = await checkAppStatus(CLAUDE_APP_NAME, FLY_API_TOKEN);
        
        if (!status.healthy) {
          // Check circuit breaker
          if (isCircuitOpen()) {
            return res.status(200).json({
              healthy: false,
              status: 'unhealthy',
              circuitBreaker: 'open',
              message: 'Too many restart attempts. Waiting for cooldown.',
              nextRetry: new Date(circuitBreaker.lastFailure + circuitBreaker.resetTimeout)
            });
          }
          
          // Attempt auto-restart
          console.log('[Fly.io Manager] App unhealthy, attempting restart...');
          const restartResult = await restartApp(CLAUDE_APP_NAME, FLY_API_TOKEN);
          
          if (restartResult.success) {
            resetCircuitBreaker();
            return res.status(200).json({
              healthy: false,
              status: 'restarting',
              message: 'App was down, restart initiated',
              restartedAt: new Date().toISOString()
            });
          } else {
            recordFailure();
            return res.status(200).json({
              healthy: false,
              status: 'restart-failed',
              error: restartResult.error,
              failures: circuitBreaker.failures
            });
          }
        }
        
        return res.status(200).json({
          healthy: true,
          status: 'running',
          app: CLAUDE_APP_NAME,
          ...status
        });
      }
      
      case 'restart': {
        // Manual restart request
        const restartResult = await restartApp(CLAUDE_APP_NAME, FLY_API_TOKEN);
        
        if (restartResult.success) {
          return res.status(200).json({
            success: true,
            message: 'Restart initiated',
            app: CLAUDE_APP_NAME
          });
        } else {
          return res.status(500).json({
            success: false,
            error: restartResult.error
          });
        }
      }
      
      case 'status': {
        // Get detailed status
        const status = await getDetailedStatus(CLAUDE_APP_NAME, FLY_API_TOKEN);
        return res.status(200).json(status);
      }
      
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[Fly.io Manager] Error:', error);
    return res.status(500).json({
      error: 'Failed to manage fly.io app',
      details: error.message
    });
  }
};

// Check if app is healthy
async function checkAppStatus(appName, token) {
  try {
    // First try to hit the health endpoint
    const healthCheck = await new Promise((resolve) => {
      const healthReq = https.request({
        hostname: `${appName}.fly.dev`,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          resolve({ healthy: true, statusCode: res.statusCode });
        } else {
          resolve({ healthy: false, statusCode: res.statusCode });
        }
      });
      
      healthReq.on('error', () => {
        resolve({ healthy: false, error: 'Connection failed' });
      });
      
      healthReq.on('timeout', () => {
        healthReq.destroy();
        resolve({ healthy: false, error: 'Timeout' });
      });
      
      healthReq.end();
    });
    
    return healthCheck;
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

// Restart the app using Fly.io API
async function restartApp(appName, token) {
  try {
    // Get app machines first
    const machines = await flyApiRequest(
      `/apps/${appName}/machines`,
      'GET',
      token
    );
    
    if (!machines || machines.length === 0) {
      return { success: false, error: 'No machines found' };
    }
    
    // Restart each machine
    const restartPromises = machines.map(machine => 
      flyApiRequest(
        `/apps/${appName}/machines/${machine.id}/restart`,
        'POST',
        token
      )
    );
    
    await Promise.all(restartPromises);
    
    return { success: true, restarted: machines.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get detailed app status
async function getDetailedStatus(appName, token) {
  try {
    const [app, machines] = await Promise.all([
      flyApiRequest(`/apps/${appName}`, 'GET', token),
      flyApiRequest(`/apps/${appName}/machines`, 'GET', token)
    ]);
    
    return {
      app: {
        name: app.name,
        status: app.status,
        deployed: app.deployed
      },
      machines: machines.map(m => ({
        id: m.id,
        state: m.state,
        region: m.region,
        created_at: m.created_at,
        updated_at: m.updated_at
      })),
      healthy: machines.some(m => m.state === 'started')
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Make Fly.io API request
function flyApiRequest(path, method, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.fly.io',
      path: `/v1${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `API error: ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Circuit breaker functions
function isCircuitOpen() {
  if (!circuitBreaker.isOpen) return false;
  
  // Check if cooldown period has passed
  const now = Date.now();
  if (now - circuitBreaker.lastFailure > circuitBreaker.resetTimeout) {
    resetCircuitBreaker();
    return false;
  }
  
  return true;
}

function recordFailure() {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  
  if (circuitBreaker.failures >= circuitBreaker.maxFailures) {
    circuitBreaker.isOpen = true;
    console.log('[Circuit Breaker] Opened after', circuitBreaker.failures, 'failures');
  }
}

function resetCircuitBreaker() {
  circuitBreaker.failures = 0;
  circuitBreaker.lastFailure = null;
  circuitBreaker.isOpen = false;
}