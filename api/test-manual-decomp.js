// Test manual decomposition
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { threadId } = req.body;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId required' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
  
  if (!CLAUDE_API_KEY || !TERRAGON_AUTH) {
    return res.status(500).json({ error: 'Missing API keys' });
  }

  try {
    // Create decomposition
    const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Decompose "Build a login form" into 2 checkpoints. Return JSON: {"taskSummary":"Build login form","checkpoints":[{"id":"cp1","name":"Create form UI","objective":"Build the form interface","blocking":true,"dependencies":[],"instructions":["Create LoginForm component","Add email input","Add password input"],"passCriteria":[{"type":"ui_complete","description":"Form displays correctly"}]}],"estimatedDuration":"20 min","riskFactors":["None"]}`
      }]
    });
    
    let decomposition;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      decomposition = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse decomposition', raw: response.content[0].text });
    }
    
    // Format message
    const message = `# TASK DECOMPOSITION COMPLETE

## Task Summary
${decomposition.taskSummary}

## Checkpoints (${decomposition.checkpoints.length})
${decomposition.checkpoints.map((cp, i) => `
### ${i + 1}. ${cp.name}
- **Objective:** ${cp.objective}
- **Instructions:** ${cp.instructions.join(', ')}
`).join('\n')}`;
    
    // Send to Terragon
    const payload = [{
      threadId: threadId,
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
    
    const sendResponse = await fetch(
      `https://www.terragonlabs.com/task/${threadId}`,
      {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f7f75ac3cce9016222850cb0f9b89dacfcdb75c9b',
          'origin': 'https://www.terragonlabs.com',
          'referer': `https://www.terragonlabs.com/task/${threadId}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'x-deployment-id': 'dpl_EcYagrYkth26MSww72T3G2EZGiUH'
        },
        body: JSON.stringify(payload)
      }
    );
    
    const sendResult = await sendResponse.text();
    
    return res.status(200).json({
      success: sendResponse.ok,
      decomposition,
      messageLength: message.length,
      sendStatus: sendResponse.status,
      sendResult: sendResult.substring(0, 200)
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}