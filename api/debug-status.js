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

  const threadId = req.query.id || req.body?.threadId || '9f9021f4-7734-41bc-9f7d-6d31e1104d4d';

  try {
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

    const pageContent = await response.text();
    
    // Debug: Find any status patterns
    const patterns = [
      /\\"status\\":\\"([^"\\\\]+)\\"/,
      /"status":"([^"]+)"/,
      /status\\":\\"([^"]+)\\"/,
      /status":"([^"]+)"/,
      /"status":\s*"([^"]+)"/
    ];
    
    const results = {};
    patterns.forEach((pattern, i) => {
      const match = pageContent.match(pattern);
      results[`pattern${i}`] = {
        pattern: pattern.toString(),
        match: match ? match[1] : null
      };
    });
    
    // Also look for specific substrings
    const hasWorkingText = pageContent.includes('working');
    const hasCompletedText = pageContent.includes('completed');
    const hasStatusText = pageContent.includes('status');
    
    // Extract a sample of content around "status" if found
    let sample = '';
    const statusIndex = pageContent.indexOf('status');
    if (statusIndex > -1) {
      sample = pageContent.substring(Math.max(0, statusIndex - 50), Math.min(pageContent.length, statusIndex + 100));
    }
    
    return res.status(200).json({
      threadId,
      patterns: results,
      indicators: {
        hasWorkingText,
        hasCompletedText,
        hasStatusText
      },
      sample,
      contentLength: pageContent.length
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}