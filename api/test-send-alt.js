import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const TERRAGON_AUTH = process.env.TERRAGON_AUTH;

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

  const { method = 'terragon', message = 'Test message', threadId } = req.body;

  try {
    switch (method) {
      case 'terragon-direct': {
        // Test direct Terragon message sending
        if (!TERRAGON_AUTH) {
          return res.status(500).json({ error: 'TERRAGON_AUTH not configured' });
        }

        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required for direct send' });
        }

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
              'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
              'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
            },
            body: JSON.stringify(payload)
          }
        );

        return res.status(200).json({
          method: 'terragon-direct',
          success: response.ok,
          status: response.status,
          threadId,
          message: response.ok ? 'Message sent successfully' : 'Send failed',
          timestamp: new Date().toISOString()
        });
      }

      case 'terragon-create': {
        // Test creating new Terragon thread
        if (!TERRAGON_AUTH) {
          return res.status(500).json({ error: 'TERRAGON_AUTH not configured' });
        }

        const createPayload = [{
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
          },
          githubRepoFullName: 'bhuman-ai/unclefrank-bootstrap',
          repoBaseBranchName: 'master',
          saveAsDraft: false
        }];

        const response = await fetch(
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
            body: JSON.stringify(createPayload)
          }
        );

        const responseText = await response.text();
        const threadIdMatch = responseText.match(/"id":"([^"]+)"/);
        const newThreadId = threadIdMatch ? threadIdMatch[1] : 'unknown';

        return res.status(200).json({
          method: 'terragon-create',
          success: response.ok,
          status: response.status,
          threadId: newThreadId,
          message: response.ok ? 'New thread created successfully' : 'Create failed',
          threadUrl: `https://www.terragonlabs.com/task/${newThreadId}`,
          timestamp: new Date().toISOString()
        });
      }

      case 'claude-direct': {
        // Test direct Claude API
        if (!CLAUDE_API_KEY) {
          return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });
        }

        const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
        
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: message
          }]
        });

        return res.status(200).json({
          method: 'claude-direct',
          success: true,
          response: response.content[0].text,
          model: response.model,
          usage: response.usage,
          timestamp: new Date().toISOString()
        });
      }

      case 'execute-api': {
        // Test via our own execute API
        try {
          const executeResponse = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send-message',
              threadId: threadId || 'test-thread',
              message: message
            })
          });

          const executeResult = await executeResponse.json();

          return res.status(200).json({
            method: 'execute-api',
            success: executeResponse.ok,
            result: executeResult,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return res.status(500).json({
            method: 'execute-api',
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      case 'comparison': {
        // Test all methods and compare results
        const results = {
          method: 'comparison',
          timestamp: new Date().toISOString(),
          tests: {}
        };

        // Test Claude Direct
        if (CLAUDE_API_KEY) {
          try {
            const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
            const claudeResponse = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 50,
              messages: [{ role: 'user', content: 'Say "Claude OK"' }]
            });
            results.tests.claude = {
              success: true,
              response: claudeResponse.content[0].text
            };
          } catch (error) {
            results.tests.claude = {
              success: false,
              error: error.message
            };
          }
        }

        // Test Terragon if thread provided
        if (TERRAGON_AUTH && threadId) {
          try {
            const terragonPayload = [{
              threadId: threadId,
              message: {
                type: 'user',
                model: 'sonnet',
                parts: [{
                  type: 'rich-text',
                  nodes: [{ type: 'text', text: 'Say "Terragon OK"' }]
                }],
                timestamp: new Date().toISOString()
              }
            }];

            const terragonResponse = await fetch(
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
                  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                  'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
                },
                body: JSON.stringify(terragonPayload)
              }
            );

            results.tests.terragon = {
              success: terragonResponse.ok,
              status: terragonResponse.status
            };
          } catch (error) {
            results.tests.terragon = {
              success: false,
              error: error.message
            };
          }
        }

        return res.status(200).json(results);
      }

      default:
        return res.status(400).json({ 
          error: 'Invalid method',
          available: ['terragon-direct', 'terragon-create', 'claude-direct', 'execute-api', 'comparison']
        });
    }
  } catch (error) {
    console.error('Send test error:', error);
    return res.status(500).json({ 
      error: error.message,
      method: method,
      timestamp: new Date().toISOString()
    });
  }
}