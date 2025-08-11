// FRANK'S CLAUDE EXECUTOR API
// Routes all task execution to Claude
// No more Claude BS!

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Forward ALL requests to Claude executor
  try {
    const response = await fetch(
      `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/claude-executor-integration`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );
    
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[Execute] Claude Executor error:', error);
    return res.status(500).json({ 
      error: 'Claude execution failed',
      details: error.message 
    });
  }
}