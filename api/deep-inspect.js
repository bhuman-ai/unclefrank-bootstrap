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

  const { threadId } = req.body;
  if (!threadId) {
    return res.status(400).json({ error: 'Thread ID required' });
  }

  try {
    // Fetch the page content
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
    
    // Extract script tags with JSON data
    const scriptMatches = [...html.matchAll(/<script[^>]*>([^<]+)<\/script>/g)];
    
    // Look for Next.js data scripts
    let nextData = null;
    let selfData = null;
    
    for (const match of scriptMatches) {
      const content = match[1];
      if (content.includes('self.__next_f')) {
        // Extract Next.js data
        const dataMatches = [...content.matchAll(/self\.__next_f\.push\(\[(.*?)\]\)/gs)];
        selfData = dataMatches.map(m => {
          try {
            const parsed = JSON.parse(`[${m[1]}]`);
            return parsed;
          } catch {
            return m[1];
          }
        });
      }
      if (content.includes('__NEXT_DATA__')) {
        try {
          nextData = JSON.parse(content);
        } catch {}
      }
    }

    // Look for RSC (React Server Component) payload
    const rscPayload = html.match(/0:.*?$/m);
    
    // Extract inline JSON from the HTML
    const inlineJsonMatches = [...html.matchAll(/(\{[^{}]*"(?:status|state|isRunning|isComplete|messages)"[^{}]*\})/g)];
    const inlineJson = inlineJsonMatches.map(m => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Look for specific patterns in the entire HTML
    const indicators = {
      // Status indicators
      hasStatusRunning: html.includes('"status":"running"') || html.includes("'status':'running'"),
      hasStatusComplete: html.includes('"status":"complete"') || html.includes("'status':'complete'"),
      hasStatusError: html.includes('"status":"error"') || html.includes("'status':'error'"),
      
      // State indicators
      hasStateActive: html.includes('"state":"active"') || html.includes("'state':'active'"),
      hasStateIdle: html.includes('"state":"idle"') || html.includes("'state':'idle'"),
      
      // Boolean flags
      hasIsRunningTrue: html.includes('"isRunning":true') || html.includes("'isRunning':true"),
      hasIsRunningFalse: html.includes('"isRunning":false') || html.includes("'isRunning':false"),
      hasIsCompleteTrue: html.includes('"isComplete":true') || html.includes("'isComplete':true"),
      hasIsCompleteFalse: html.includes('"isComplete":false') || html.includes("'isComplete':false"),
      
      // UI states
      hasSpinner: html.includes('spinner') || html.includes('loading'),
      hasThinking: html.includes('thinking') || html.includes('Thinking'),
      hasGenerating: html.includes('generating') || html.includes('Generating'),
      
      // Message indicators
      messageCount: (html.match(/"text":/g) || []).length,
      hasAssistantMessage: html.includes('"type":"assistant"') || html.includes("'type':'assistant'"),
      hasUserMessage: html.includes('"type":"user"') || html.includes("'type':'user'"),
      
      // Completion phrases
      hasDoneCounting: html.includes('DONE COUNTING'),
      hasTaskComplete: html.includes('task complete') || html.includes('Task complete'),
      hasFinishedPhrase: html.includes('finished') || html.includes('Finished'),
      hasCompletedPhrase: html.includes('completed') || html.includes('Completed')
    };

    // Extract any data-* attributes that might contain state
    const dataAttributes = [...html.matchAll(/data-([^=]+)="([^"]+)"/g)].map(m => ({
      name: m[1],
      value: m[2]
    })).filter(attr => 
      attr.value.includes('status') || 
      attr.value.includes('state') || 
      attr.value.includes('complete') ||
      attr.value.includes('running')
    );

    return res.status(200).json({
      threadId,
      timestamp: new Date().toISOString(),
      indicators,
      dataAttributes,
      inlineJson,
      rscPayload: rscPayload ? rscPayload[0].substring(0, 200) + '...' : null,
      selfData: selfData ? selfData.slice(0, 3) : null,
      nextData: nextData ? {
        hasProps: !!nextData.props,
        hasPageProps: !!nextData.props?.pageProps,
        buildId: nextData.buildId
      } : null,
      contentLength: html.length
    });

  } catch (error) {
    console.error('Deep inspection error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}