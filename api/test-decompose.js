// Test endpoint to debug task decomposition
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    console.log('Testing decomposition prompt...');
    
    const taskMessage = "Build a calculator component with add, subtract, multiply, and divide functions";
    
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Task: ${taskMessage.substring(0, 200)}. Return only JSON: {"taskSummary":"${taskMessage.substring(0, 50).replace(/["\n]/g, ' ')}","checkpoints":[{"id":"cp1","name":"Create API file","objective":"Create /api/hello-frank.js","blocking":true,"dependencies":[],"instructions":["Create /api/hello-frank.js","Export handler function","Return JSON response"],"passCriteria":[{"type":"file_exists","description":"File exists"},{"type":"file_valid","description":"Valid JS syntax"}]},{"id":"cp2","name":"Test endpoint","objective":"Verify it works","blocking":false,"dependencies":["cp1"],"instructions":["Test GET request","Check response"],"passCriteria":[{"type":"api_responds","description":"Returns 200"},{"type":"has_content","description":"Has Hello message"}]}],"estimatedDuration":"5 min","riskFactors":["None"]}`
      }]
    });
    
    const text = response.content[0].text;
    console.log('Raw response:', text);
    
    // Try to extract JSON
    let parsed;
    let jsonString = text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
      console.log('Extracted JSON from response');
    }
    
    try {
      parsed = JSON.parse(jsonString);
      console.log('Parsed successfully');
    } catch (e) {
      console.error('Parse failed:', e.message);
      parsed = { error: 'Failed to parse', raw: text };
    }
    
    return res.status(200).json({
      success: true,
      raw: text,
      parsed: parsed,
      model: response.model,
      messageLength: taskMessage.length,
      promptLength: taskMessage.length
    });
    
  } catch (error) {
    console.error('Decompose test error:', error);
    return res.status(500).json({ 
      error: error.message,
      type: error.error?.type
    });
  }
}