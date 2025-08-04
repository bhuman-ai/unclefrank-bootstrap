export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { threadId } = req.body;
  if (!threadId) {
    return res.status(400).json({ error: 'threadId required' });
  }

  const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
  if (!TERRAGON_AUTH) {
    return res.status(500).json({ error: 'TERRAGON_AUTH not configured' });
  }

  try {
    const response = await fetch(
      `https://www.terragonlabs.com/task/${threadId}`,
      {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
          'origin': 'https://www.terragonlabs.com',
          'referer': `https://www.terragonlabs.com/task/${threadId}`,
          'user-agent': 'Mozilla/5.0',
          'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
        },
        body: JSON.stringify([threadId])
      }
    );

    const content = await response.text();
    
    // Extract messages
    const messages = [];
    const messageMatches = [...content.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)];
    
    for (const match of messageMatches) {
      messages.push(match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
    }
    
    // Extract status
    const statusMatch = content.match(/"status":"([^"]+)"/);
    const status = statusMatch ? statusMatch[1] : 'unknown';
    
    return res.status(200).json({
      threadId,
      status,
      messageCount: messages.length,
      messages: messages.slice(0, 5), // First 5 messages
      contentLength: content.length,
      contentPreview: content.substring(0, 500)
    });
    
  } catch (error) {
    return res.status(500).json({ 
      error: error.message
    });
  }
}