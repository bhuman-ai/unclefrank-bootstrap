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
    
    console.log('Testing Opus 4...');
    
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: 'Respond with ONLY a JSON object, no other text:\n{"test": "success", "model": "opus-4"}'
      }]
    });
    
    const text = response.content[0].text;
    console.log('Raw response:', text);
    
    // Try to parse as JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
      console.log('Parsed successfully:', parsed);
    } catch (e) {
      console.error('Parse failed:', e.message);
      parsed = { error: 'Failed to parse', raw: text };
    }
    
    return res.status(200).json({
      success: true,
      raw: text,
      parsed: parsed,
      model: response.model
    });
    
  } catch (error) {
    console.error('Opus test error:', error);
    return res.status(500).json({ 
      error: error.message,
      type: error.error?.type
    });
  }
}