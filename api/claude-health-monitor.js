// FRANK'S CLAUDE HEALTH MONITOR
// Proactive monitoring and auto-restart for Claude executor

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
  
  try {
    switch (action) {
      case 'ensure-running': {
        // Check if Claude is running
        let isHealthy = false;
        try {
          const healthResponse = await fetch(`${CLAUDE_EXECUTOR_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          });
          isHealthy = healthResponse.ok;
        } catch (error) {
          isHealthy = false;
        }
        
        if (!isHealthy) {
          console.log('[Claude Monitor] Service is down, triggering restart...');
          
          // Trigger fly.io restart
          try {
            const restartResponse = await fetch(
              `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/flyio-manager`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart' })
              }
            );
            
            if (restartResponse.ok) {
              const result = await restartResponse.json();
              return res.status(200).json({
                success: true,
                restarted: true,
                message: 'Claude executor restart initiated',
                ...result
              });
            }
          } catch (restartError) {
            console.error('[Claude Monitor] Restart failed:', restartError);
          }
        }
        
        return res.status(200).json({
          success: true,
          healthy: isHealthy,
          message: isHealthy ? 'Claude executor is running' : 'Claude executor is down'
        });
      }
      
      case 'force-restart': {
        // Force a restart regardless of health
        try {
          const restartResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/flyio-manager`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'restart' })
            }
          );
          
          if (restartResponse.ok) {
            const result = await restartResponse.json();
            return res.status(200).json({
              success: true,
              message: 'Force restart initiated',
              ...result
            });
          }
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: 'Failed to restart',
            details: error.message
          });
        }
      }
      
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[Claude Monitor] Error:', error);
    return res.status(500).json({
      error: 'Monitor error',
      details: error.message
    });
  }
};