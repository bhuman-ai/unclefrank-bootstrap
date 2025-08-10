import { NextApiRequest, NextApiResponse } from 'next';

const CLAUDE_FLY_URL = process.env.CLAUDE_FLY_URL || 'https://uncle-frank-claude.fly.dev';

// Store session IDs per user (in production, use proper session management)
const userSessions = new Map<string, string>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create a session for this user
    const userId = req.headers['x-user-id'] as string || 'default-user';
    let sessionId = userSessions.get(userId);

    // Create new session if needed
    if (!sessionId) {
      console.log('Creating new Claude session on Fly.io...');
      const sessionResponse = await fetch(`${CLAUDE_FLY_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: 'https://github.com/bhuman-ai/unclefrank-bootstrap'
        })
      });

      if (!sessionResponse.ok) {
        const error = await sessionResponse.text();
        console.error('Failed to create session:', error);
        throw new Error('Failed to create Claude session');
      }

      const sessionData = await sessionResponse.json();
      sessionId = sessionData.sessionId;
      userSessions.set(userId, sessionId);
      console.log(`Created session: ${sessionId}`);
    }

    // Send message to Claude with Frank's personality
    const frankMessage = `You are Uncle Frank, a no-nonsense guy from Brooklyn who gets stuff done. 
Be direct, cut through BS, and focus on ACTION. You're managing a doc-driven development platform.

User says: "${message}"

${context?.currentContent ? `Current document:\n${context.currentContent}\n` : ''}
${context?.action === 'edit_document' ? 'The user wants you to edit the document above.' : ''}

Respond as Frank. Be concise but helpful. If they want changes, describe what you'll do.`;

    console.log(`Sending to Claude session ${sessionId}...`);
    const executeResponse = await fetch(`${CLAUDE_FLY_URL}/api/sessions/${sessionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: frankMessage })
    });

    if (!executeResponse.ok) {
      const error = await executeResponse.text();
      console.error('Execute failed:', error);
      throw new Error('Failed to execute Claude command');
    }

    // Poll for response (max 15 seconds)
    let response = null;
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts && !response) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`${CLAUDE_FLY_URL}/api/sessions/${sessionId}/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        console.log(`Attempt ${attempts + 1}: Status = ${status.status}`);
        
        // Check terminal for response
        const terminalResponse = await fetch(`${CLAUDE_FLY_URL}/api/sessions/${sessionId}/terminal`);
        if (terminalResponse.ok) {
          const terminalData = await terminalResponse.json();
          
          // Check if Claude has responded (look for new content after our message)
          if (terminalData.terminal && terminalData.terminal.includes(message)) {
            // Extract Claude's response (text after our message)
            const parts = terminalData.terminal.split(message);
            if (parts.length > 1) {
              const claudeResponse = parts[parts.length - 1];
              // Clean up the response
              response = claudeResponse
                .replace(/╭─+╮[\s\S]*?╰─+╯/g, '') // Remove box drawing
                .replace(/●.*?\n/g, '') // Remove command indicators
                .replace(/⎿.*?\n/g, '') // Remove output indicators
                .replace(/\[.*?\]/g, '') // Remove ANSI codes
                .replace(/bypass permissions.*?\n/g, '') // Remove UI hints
                .replace(/>\s*$/g, '') // Remove prompt
                .replace(/\n{3,}/g, '\n\n') // Clean up newlines
                .trim();
              
              if (response && response.length > 10) {
                break;
              }
            }
          }
        }
      }
      attempts++;
    }

    if (!response) {
      response = "Hold on, I'm thinking. The system's processing your request. Try again in a sec.";
    }

    console.log(`Frank's response: ${response.substring(0, 100)}...`);

    // Return Frank's response
    res.status(200).json({
      response: response,
      action: context?.action === 'edit_document' ? 'document_updated' : 'general_response',
      sessionId: sessionId
    });

  } catch (error) {
    console.error('Frank assistant error:', error);
    res.status(500).json({
      response: "The Claude executor's having issues. Check if Fly.io is running properly.",
      error: error.message
    });
  }
}