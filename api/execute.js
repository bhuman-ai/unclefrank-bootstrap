import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

class TerragonExecutor {
  constructor() {
    this.baseUrl = 'https://www.terragonlabs.com/dashboard';
    this.deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';
  }

  async sendToTerragon(message, githubRepo = 'bhuman-ai/unclefrank-bootstrap') {
    const payload = JSON.stringify([{
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
      },
      githubRepoFullName: githubRepo,
      repoBaseBranchName: 'master',
      saveAsDraft: false
    }]);

    try {
      const response = await axios.post(
        this.baseUrl,
        payload,
        {
          headers: {
            'accept': 'text/x-component',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
            'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(sidebar)%22%2C%7B%22children%22%3A%5B%22(site-header)%22%2C%7B%22children%22%3A%5B%22dashboard%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
            'origin': 'https://www.terragonlabs.com',
            'referer': 'https://www.terragonlabs.com/dashboard',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-deployment-id': this.deploymentId
          }
        }
      );

      // Terragon returns React Server Components, not JSON
      // Look for task ID in response
      const responseText = response.data;
      const idMatch = responseText.match(/"id":"([^"]+)"/);
      
      if (idMatch) {
        return {
          success: true,
          data: `Task created in Terragon with ID: ${idMatch[1]}`
        };
      }
      
      return {
        success: true,
        data: 'Message sent to Terragon'
      };
    } catch (error) {
      // Terragon returns 500 but still creates the task
      if (error.response?.status === 500 && error.response?.data) {
        const responseText = error.response.data;
        const idMatch = responseText.match(/"id":"([^"]+)"/);
        
        if (idMatch) {
          console.log(`Task created in Terragon with ID: ${idMatch[1]}`);
          return {
            success: true,
            data: `Task created in Terragon with ID: ${idMatch[1]}`
          };
        }
      }
      
      console.error('Terragon API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
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

        // Send to Terragon
        const result = await executor.sendToTerragon(message);

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