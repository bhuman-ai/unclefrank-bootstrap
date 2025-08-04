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
          'next-action': '7f7f75ac3cce9016222850cb0f9b89dacfcdb75c9b',
          'origin': 'https://www.terragonlabs.com',
          'referer': `https://www.terragonlabs.com/task/${threadId}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'x-deployment-id': 'dpl_EcYagrYkth26MSww72T3G2EZGiUH'
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
      messages: messages, // Return ALL messages
      contentLength: content.length,
      contentPreview: content.substring(0, 500)
    });
    
  } catch (error) {
    return res.status(500).json({ 
      error: error.message
    });
  }
}