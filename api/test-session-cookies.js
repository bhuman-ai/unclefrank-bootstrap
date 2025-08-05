// Test endpoint to analyze session cookie changes
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

  const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
  if (!TERRAGON_AUTH) {
    return res.status(500).json({ error: 'TERRAGON_AUTH not configured' });
  }

  try {
    console.log('=== SESSION COOKIE TEST ===');
    
    // First request to get initial state
    const response1 = await fetch(
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

    // Extract cookies from response
    const setCookieHeaders1 = response1.headers.get('set-cookie');
    console.log('Response 1 set-cookie:', setCookieHeaders1);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));
    
    // Second request
    const response2 = await fetch(
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

    const setCookieHeaders2 = response2.headers.get('set-cookie');
    console.log('Response 2 set-cookie:', setCookieHeaders2);
    
    // Try sending a message without all cookies
    const messagePayload = [{
      threadId: threadId,
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: 'Test message without session cookies'
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
          'user-agent': 'Mozilla/5.0',
          'x-deployment-id': 'dpl_EcYagrYkth26MSww72T3G2EZGiUH'
        },
        body: JSON.stringify(messagePayload)
      }
    );
    
    const sendContent = await sendResponse.text();
    
    return res.status(200).json({
      test: 'session-cookie-analysis',
      results: {
        request1: {
          status: response1.status,
          setCookie: setCookieHeaders1 || 'none'
        },
        request2: {
          status: response2.status,
          setCookie: setCookieHeaders2 || 'none'
        },
        sendAttempt: {
          status: sendResponse.status,
          success: sendResponse.ok && !sendContent.includes('E{\"digest\"'),
          responsePreview: sendContent.substring(0, 200)
        }
      },
      conclusion: 'Session cookies are required but not being captured'
    });
    
  } catch (error) {
    return res.status(500).json({ 
      error: error.message
    });
  }
}