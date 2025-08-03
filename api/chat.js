// Vercel Edge Function for Terragon Chat
import axios from 'axios';

const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';
const TERRAGON_BASE_URL = 'https://www.terragonlabs.com';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await handleSendMessage(req, res);
      case 'GET':
        return await handleGetMessages(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}

async function handleSendMessage(req, res) {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ 
      error: 'Missing required fields: threadId and message' 
    });
  }

  try {
    const payload = [{
      threadId,
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

    const response = await axios.post(
      `${TERRAGON_BASE_URL}/task/${threadId}`,
      payload,
      {
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
          'origin': TERRAGON_BASE_URL,
          'referer': `${TERRAGON_BASE_URL}/task/${threadId}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
        }
      }
    );

    // Extract messages from response
    const messages = extractMessages(response.data);
    
    res.status(200).json({ 
      success: true, 
      threadId,
      message: 'Message sent successfully',
      responses: messages
    });
  } catch (error) {
    console.error('Failed to send message:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.response?.data || error.message 
    });
  }
}

async function handleGetMessages(req, res) {
  const { threadId } = req.query;

  if (!threadId) {
    return res.status(400).json({ 
      error: 'Missing required query parameter: threadId' 
    });
  }

  try {
    const response = await axios.get(
      `${TERRAGON_BASE_URL}/task/${threadId}`,
      {
        headers: {
          'accept': 'text/x-component',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'referer': `${TERRAGON_BASE_URL}/task/${threadId}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
        }
      }
    );

    const messages = extractMessages(response.data);
    
    res.status(200).json({ 
      success: true, 
      threadId,
      messages 
    });
  } catch (error) {
    console.error('Failed to get messages:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get messages', 
      details: error.response?.data || error.message 
    });
  }
}

function extractMessages(responseData) {
  const messages = [];
  try {
    const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    const messageMatches = responseText.matchAll(/"text":"([^"]+)"/g);
    
    for (const match of messageMatches) {
      const text = match[1];
      // Decode any escaped characters
      const decodedText = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      messages.push({
        text: decodedText,
        timestamp: new Date().toISOString(),
        type: 'assistant'
      });
    }
  } catch (error) {
    console.error('Error extracting messages:', error);
  }
  return messages;
}

export const config = {
  runtime: 'edge',
};