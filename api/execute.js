import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

class TerragonExecutor {
  constructor() {
    this.baseUrl = 'https://www.terragonlabs.com';
    this.deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';
    this.activeThreads = new Map();
  }

  async sendToTerragon(message, sessionId) {
    // Get or create thread for this session
    let threadId = this.activeThreads.get(sessionId);
    if (!threadId) {
      threadId = `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      this.activeThreads.set(sessionId, threadId);
    }

    const payload = [{
      threadId,
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: message
          }]
        }],
        timestamp: new Date().toISOString()
      }
    }];

    try {
      const response = await fetch(
        `${this.baseUrl}/task/${threadId}`,
        {
          method: 'POST',
          headers: {
            'accept': 'text/x-component',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
            'origin': this.baseUrl,
            'referer': `${this.baseUrl}/task/${threadId}`,
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-deployment-id': this.deploymentId
          },
          body: JSON.stringify(payload)
        }
      );

      return {
        success: true,
        threadId,
        data: 'Message sent to Terragon chat'
      };
    } catch (error) {
      console.error('Terragon Chat Error:', error.message);
      return {
        success: false,
        error: `Failed to send to Terragon: ${error.message}`
      };
    }
  }
}

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

  const { action, checkpoint, projectContext, sessionId } = req.body;

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ 
      error: 'CLAUDE_API_KEY not configured',
      instructions: 'Add CLAUDE_API_KEY to Vercel environment variables'
    });
  }

  const executor = new TerragonExecutor();

  try {
    switch (action) {
      case 'start': {
        // Initialize execution session
        return res.status(200).json({
          sessionId: `session-${Date.now()}`,
          status: 'ready',
          message: 'Execution session started'
        });
      }

      case 'execute': {
        if (!checkpoint) {
          return res.status(400).json({ error: 'Checkpoint required' });
        }

        // Build execution message
        const message = `# CHECKPOINT EXECUTION

## Checkpoint: ${checkpoint.name}
**Objective:** ${checkpoint.objective}

## Instructions
${checkpoint.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

## Pass Criteria
${checkpoint.passCriteria.map(pc => `- ${pc.description}`).join('\n')}

Execute this checkpoint and report results.`;

        // Send to Terragon chat
        const result = await executor.sendToTerragon(message, sessionId);

        if (!result.success) {
          return res.status(500).json({
            status: 'error',
            error: result.error
          });
        }

        // Return execution result
        return res.status(200).json({
          status: 'executed',
          checkpointId: checkpoint.id,
          threadId: result.threadId,
          response: result.data,
          timestamp: new Date().toISOString()
        });
      }

      case 'test': {
        if (!checkpoint) {
          return res.status(400).json({ error: 'Checkpoint required' });
        }

        // Tests should be run in Terragon
        // For now, return pending status
        return res.status(200).json({
          checkpointId: checkpoint.id,
          status: 'pending',
          message: 'Tests should be executed in Terragon',
          timestamp: new Date().toISOString()
        });
      }

      case 'status': {
        // Get status of a thread
        const { threadId } = req.body;
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required' });
        }
        
        return res.status(200).json({
          threadId,
          status: 'active',
          message: `Check thread at: https://www.terragonlabs.com/task/${threadId}`
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Execution API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}