import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MetaAgent } from '../src/agents/meta-agent.js';
import { DocumentManager } from '../src/core/document-manager.js';
import { TerragonProxy } from '../src/core/terragon-proxy.js';
import { PrincipleEnforcer } from '../src/core/principle-enforcer.js';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { action, request, projectContext } = req.body;

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });
  }

  try {
    const metaAgent = new MetaAgent(CLAUDE_API_KEY);
    const principleEnforcer = new PrincipleEnforcer('/tmp');
    const terragonProxy = new TerragonProxy(TERRAGON_AUTH);

    switch (action) {
      case 'classify': {
        const classification = await metaAgent.classifyRequest(request);
        return res.status(200).json({ classification });
      }

      case 'decompose': {
        const { task, checkpoints } = await metaAgent.decomposeTask(request, projectContext || '');
        return res.status(200).json({ task, checkpoints });
      }

      case 'validate': {
        await principleEnforcer.loadPrinciples();
        const validation = await principleEnforcer.validateAction(request);
        return res.status(200).json({ validation });
      }

      case 'execute': {
        // This would need more implementation for full execution
        return res.status(200).json({ 
          message: 'Execution endpoint ready. Full implementation needed for checkpoint execution.' 
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}