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
    // Step 1: Create a simple test task in Terragon
    console.log('Creating test task in Terragon...');
    
    const testPayload = [{
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: 'Create a file called NATURAL_COMPLETION_TEST.txt with the content "Natural completion detection works!"'
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

    console.log(`Task created with thread ID: ${threadId}`);

    // Step 2: Poll for natural completion
    const messageTracker = {
      lastMessageCount: 0,
      lastMessageTime: Date.now()
    };

    const pollUntilComplete = async () => {
      let pollCount = 0;
      const maxPolls = 60; // 5 minutes max (5 seconds * 60)
      
      while (pollCount < maxPolls) {
        pollCount++;
        
        // Wait 5 seconds between polls
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(`Poll ${pollCount}: Checking Terragon status...`);
        
        const statusResponse = await fetch(
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

        const pageContent = await statusResponse.text();
        
        // Extract messages
        const messageMatches = [...pageContent.matchAll(/"text":"([^"]+)"/g)];
        const currentMessageCount = messageMatches.length;
        
        let lastResponse = '';
        if (messageMatches.length > 0) {
          const lastMessageMatch = messageMatches[messageMatches.length - 1];
          lastResponse = lastMessageMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        
        // Natural completion detection
        const now = Date.now();
        const timeSinceLastMessage = now - messageTracker.lastMessageTime;
        
        if (lastResponse.length > 0) {
          if (currentMessageCount > messageTracker.lastMessageCount) {
            // New message arrived - update tracker
            console.log(`New message detected (count: ${currentMessageCount})`);
            messageTracker.lastMessageCount = currentMessageCount;
            messageTracker.lastMessageTime = now;
          } else if (timeSinceLastMessage > 30000) {
            // No new messages for 30 seconds - completion detected!
            console.log('Natural completion detected - no new messages for 30 seconds');
            return {
              completed: true,
              messageCount: currentMessageCount,
              lastResponse,
              timeSinceLastMessage,
              pollCount
            };
          } else {
            console.log(`Waiting... (${Math.round(timeSinceLastMessage/1000)}s since last message)`);
          }
        } else if (pageContent.includes('Waiting for') || pageContent.includes('provisioning')) {
          console.log('Terragon is still starting up...');
        }
      }
      
      return {
        completed: false,
        error: 'Polling timeout - max polls reached',
        pollCount
      };
    };

    // Start polling
    const result = await pollUntilComplete();
    
    return res.status(200).json({
      threadId,
      threadUrl: `https://www.terragonlabs.com/task/${threadId}`,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test completion error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}