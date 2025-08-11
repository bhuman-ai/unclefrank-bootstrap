import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

class MetaAgent {
  constructor(apiKey) {
    this.claude = new Anthropic({ apiKey });
  }

  async classifyRequest(message) {
    const patterns = {
      ACTION: [
        /\b(implement|create|build|add|fix|refactor|update)\b/i,
        /\b(set up|setup|integrate|deploy)\b/i
      ],
      INFO: [
        /^(what|how|why|when|where|who|explain|tell me|describe)\b/i,
        /\b(does|is|are|can|could|should)\s+\w+\?$/i
      ],
      PLANNING: [
        /\b(plan|design|architect|structure|organize|think about)\b/i,
        /\b(approach|strategy|best way)\b/i
      ],
      STATUS: [
        /\b(status|progress|update|how's|where are we)\b/i,
        /\b(going|doing|complete|done)\b/i
      ]
    };

    const lower = message.toLowerCase();
    for (const [type, typePatterns] of Object.entries(patterns)) {
      for (const pattern of typePatterns) {
        if (pattern.test(lower)) {
          return {
            type,
            confidence: 0.8,
            reasoning: `Matched pattern for ${type}`
          };
        }
      }
    }

    return {
      type: 'GENERAL',
      confidence: 0.5,
      reasoning: 'No specific pattern matched'
    };
  }

  async decomposeTask(request, projectContext) {
    const prompt = `You are Uncle Frank, a no-nonsense guy from Brooklyn who breaks down complex tasks into micro-actions.

PROJECT CONTEXT:
${projectContext}

USER REQUEST:
${request}

DECOMPOSITION RULES:
1. Each checkpoint must take ≤10 minutes to complete
2. Binary pass/fail criteria only - no ambiguity
3. Be specific about implementation details
4. Include validation checkpoints
5. No fluff, no corporate BS - just actionable steps

FORMAT YOUR RESPONSE AS JSON:
{
  "task": {
    "name": "Short, clear task name",
    "objective": "What we're actually doing",
    "acceptanceCriteria": [
      {"description": "Binary test that proves it works"}
    ]
  },
  "checkpoints": [
    {
      "name": "Specific action",
      "objective": "Clear micro-goal",
      "instructions": ["Step 1", "Step 2"],
      "passCriteria": [
        {"description": "Binary test", "testCommand": "optional test command"}
      ],
      "blocking": true/false,
      "parallelizable": true/false
    }
  ]
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Add IDs and metadata
      const taskId = `task-${Date.now()}`;
      const task = {
        ...parsed.task,
        id: taskId,
        description: request,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptanceCriteria: parsed.task.acceptanceCriteria.map((ac) => ({
          ...ac,
          id: `ac-${Date.now()}-${Math.random()}`,
          passed: false
        })),
        checkpoints: []
      };

      const checkpoints = parsed.checkpoints.map((cp, index) => ({
        ...cp,
        id: `checkpoint-${Date.now()}-${index}`,
        taskId: task.id,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        logs: [],
        passCriteria: cp.passCriteria.map((pc) => ({
          ...pc,
          id: `pc-${Date.now()}-${Math.random()}`,
          passed: false
        }))
      }));

      task.checkpoints = checkpoints;

      return { task, checkpoints };
    } catch (error) {
      console.error('Decomposition failed:', error);
      throw error;
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

  const { action, request, projectContext } = req.body;

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ 
      error: 'CLAUDE_API_KEY not configured. Please add it to Vercel environment variables.',
      instructions: 'Go to https://vercel.com/bhuman/unclefrank-bootstrap/settings/environment-variables and add CLAUDE_API_KEY'
    });
  }

  try {
    const metaAgent = new MetaAgent(CLAUDE_API_KEY);

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
        // Simplified validation for now
        return res.status(200).json({ 
          validation: {
            allowed: true,
            violations: [],
            reasoning: 'Validation system not yet implemented'
          }
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isAnthropicError = errorMessage.includes('401') || errorMessage.includes('authentication');
    
    return res.status(500).json({ 
      error: isAnthropicError 
        ? 'Invalid CLAUDE_API_KEY. Please check your Anthropic API key in Vercel settings.'
        : errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}