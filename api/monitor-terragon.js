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

  try {
    // Create a new task that will complete quickly
    console.log('Creating Terragon task...');
    
    const testPayload = [{
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: 'Say "Hello World" and nothing else'
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
    const threadId = threadIdMatch ? threadIdMatch[1] : null;

    if (!threadId) {
      return res.status(500).json({ error: 'Failed to create Terragon task' });
    }

    console.log(`Task created: ${threadId}`);

    // Monitor the thread for 2 minutes, checking every 3 seconds
    const checkInterval = 3000;
    const maxChecks = 40;
    const timeline = [];

    for (let i = 0; i < maxChecks; i++) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      const response = await fetch(
        `https://www.terragonlabs.com/task/${threadId}`,
        {
          method: 'GET',
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'referer': 'https://www.terragonlabs.com/dashboard',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
          }
        }
      );

      const html = await response.text();
      
      // Check various indicators
      const state = {
        time: i * checkInterval / 1000,
        hasSpinner: html.includes('spinner') || html.includes('loading'),
        hasThinking: html.includes('thinking') || html.includes('Thinking'),
        messageCount: (html.match(/"text":/g) || []).length,
        hasAssistantReply: html.includes('"type":"assistant"'),
        hasHelloWorld: html.includes('Hello World'),
        // Look for specific UI states
        hasCursorBlink: html.includes('cursor-blink') || html.includes('animate-pulse'),
        hasGenerating: html.includes('generating') || html.includes('Generating'),
        // Check for completion indicators
        lastMessageTime: null,
        contentLength: html.length
      };

      // Extract last message timestamp if available
      const timestampMatches = [...html.matchAll(/"timestamp":\s*"([^"]+)"/g)];
      if (timestampMatches.length > 0) {
        state.lastMessageTime = timestampMatches[timestampMatches.length - 1][1];
      }

      timeline.push(state);
      
      // If we see the response and no more changes for 3 checks, assume complete
      if (state.hasHelloWorld && !state.hasSpinner && !state.hasThinking) {
        const lastThreeStates = timeline.slice(-3);
        if (lastThreeStates.length >= 3 && 
            lastThreeStates.every(s => s.messageCount === state.messageCount)) {
          console.log('Completion detected - no changes for 9 seconds');
          break;
        }
      }
    }

    // Analyze the timeline for patterns
    const analysis = {
      totalTime: timeline[timeline.length - 1].time,
      firstResponseTime: timeline.find(s => s.hasAssistantReply)?.time || null,
      completionTime: timeline.find(s => s.hasHelloWorld && !s.hasSpinner)?.time || null,
      spinnerDisappearedAt: (() => {
        for (let i = 1; i < timeline.length; i++) {
          if (timeline[i - 1].hasSpinner && !timeline[i].hasSpinner) {
            return timeline[i].time;
          }
        }
        return null;
      })(),
      thinkingDisappearedAt: (() => {
        for (let i = 1; i < timeline.length; i++) {
          if (timeline[i - 1].hasThinking && !timeline[i].hasThinking) {
            return timeline[i].time;
          }
        }
        return null;
      })(),
      finalMessageCount: timeline[timeline.length - 1].messageCount
    };

    return res.status(200).json({
      threadId,
      threadUrl: `https://www.terragonlabs.com/task/${threadId}`,
      timeline,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Monitor error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}