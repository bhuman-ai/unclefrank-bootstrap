// Properly send message to Terragon by fetching first to get the digest
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { threadId, message } = req.body;
  if (!threadId || !message) {
    return res.status(400).json({ error: 'threadId and message required' });
  }

  const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
  if (!TERRAGON_AUTH) {
    return res.status(500).json({ error: 'TERRAGON_AUTH not configured' });
  }

  try {
    // First fetch to get current state
    const fetchResponse = await fetch(
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

    const fetchContent = await fetchResponse.text();
    
    // Now send the message using the same headers that work for sending
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
    
    const sendContent = await sendResponse.text();
    
    // Check if message was sent successfully
    const success = sendResponse.ok && !sendContent.includes('E{"digest"');
    
    return res.status(200).json({
      success,
      status: sendResponse.status,
      message: success ? 'Message sent successfully' : 'Failed to send message',
      debug: {
        responsePreview: sendContent.substring(0, 200)
      }
    });
    
  } catch (error) {
    return res.status(500).json({ 
      error: error.message
    });
  }
}