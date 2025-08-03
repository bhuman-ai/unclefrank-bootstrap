const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

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

  const { threadId, action } = req.body;

  if (!threadId && action !== 'create') {
    return res.status(400).json({ error: 'Thread ID required' });
  }

  try {
    if (action === 'create') {
      // Create a test task and start monitoring
      const testPayload = [{
        message: {
          type: 'user',
          model: 'sonnet',
          parts: [{
            type: 'rich-text',
            nodes: [{
              type: 'text',
              text: 'Count from 1 to 5 slowly, then say "DONE COUNTING"'
            }]
          }],
          timestamp: new Date().toISOString()
        },
        githubRepoFullName: 'bhuman-ai/unclefrank-bootstrap',
        repoBaseBranchName: 'master',
        saveAsDraft: false
      }];

      const createResponse = await fetch(
        'https://www.terragonlabs.com/dashboard',
        {
          method: 'POST',
          headers: {
            'accept': 'text/x-component',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
            'origin': 'https://www.terragonlabs.com',
            'referer': 'https://www.terragonlabs.com/dashboard',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
          },
          body: JSON.stringify(testPayload)
        }
      );

      const responseText = await createResponse.text();
      const threadIdMatch = responseText.match(/"id":"([^"]+)"/);
      const newThreadId = threadIdMatch ? threadIdMatch[1] : null;

      return res.status(200).json({
        action: 'created',
        threadId: newThreadId,
        message: 'Task created. Now call this endpoint with action: "inspect" to monitor'
      });
    }

    // Inspect existing thread
    console.log(`\n=== INSPECTING TERRAGON THREAD: ${threadId} ===`);
    
    // Try different endpoints and methods to see what data we get
    const endpoints = [
      {
        name: 'Task Page (GET)',
        url: `https://www.terragonlabs.com/task/${threadId}`,
        method: 'GET',
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'referer': 'https://www.terragonlabs.com/dashboard',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
        }
      },
      {
        name: 'Task API (POST)',
        url: `https://www.terragonlabs.com/task/${threadId}`,
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
          'origin': 'https://www.terragonlabs.com',
          'referer': `https://www.terragonlabs.com/task/${threadId}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
        },
        body: JSON.stringify([]) // Empty payload to just get current state
      }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      try {
        const options = {
          method: endpoint.method,
          headers: endpoint.headers
        };
        
        if (endpoint.body) {
          options.body = endpoint.body;
        }

        const response = await fetch(endpoint.url, options);
        const text = await response.text();
        
        // Extract interesting patterns
        const patterns = {
          status: text.match(/"status":\s*"([^"]+)"/g),
          state: text.match(/"state":\s*"([^"]+)"/g),
          isComplete: text.match(/"isComplete":\s*(true|false)/g),
          isRunning: text.match(/"isRunning":\s*(true|false)/g),
          messages: [...text.matchAll(/"text":"([^"]+)"/g)].length,
          timestamps: [...text.matchAll(/"timestamp":\s*"([^"]+)"/g)].map(m => m[1]),
          errors: text.match(/"error":\s*"([^"]+)"/g),
          // Look for specific indicators
          hasWaitingFor: text.includes('Waiting for'),
          hasProvisioning: text.includes('provisioning'),
          hasSandbox: text.includes('Sandbox'),
          // Look for completion indicators
          hasDone: text.includes('DONE'),
          hasCompleted: text.includes('completed'),
          hasFinished: text.includes('finished'),
          // Response metadata
          responseHeaders: Object.fromEntries(response.headers.entries()),
          responseStatus: response.status,
          contentLength: text.length
        };

        // Look for any JSON structures
        let jsonStructures = [];
        try {
          // Try to find JSON objects in the response
          const jsonMatches = text.match(/\{[^{}]*\}/g);
          if (jsonMatches) {
            jsonStructures = jsonMatches.map(match => {
              try {
                return JSON.parse(match);
              } catch {
                return null;
              }
            }).filter(Boolean);
          }
        } catch {}

        results[endpoint.name] = {
          patterns,
          jsonStructures: jsonStructures.slice(0, 5), // First 5 JSON objects
          sampleContent: text.substring(0, 500) // First 500 chars
        };

      } catch (error) {
        results[endpoint.name] = {
          error: error.message
        };
      }
    }

    return res.status(200).json({
      threadId,
      timestamp: new Date().toISOString(),
      inspection: results,
      analysis: {
        hint: 'Look for status/state fields, isRunning/isComplete booleans, or specific patterns in the responses'
      }
    });

  } catch (error) {
    console.error('Inspection error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}