#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  // Use existing thread to save time
  const threadId = 'c498bc3e-620f-4c70-aac5-32a6ee15f984';
  
  console.log('🧪 Testing Simple Message Send\n');
  console.log(`Thread: ${threadId}\n`);
  
  // Try 1: Direct POST without any session cookies
  console.log('1️⃣ Try direct POST (no session cookies)...');
  try {
    const response = await fetch(
      `https://www.terragonlabs.com/task/${threadId}`,
      {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${process.env.TERRAGON_AUTH}`,
          'origin': 'https://www.terragonlabs.com',
          'referer': `https://www.terragonlabs.com/task/${threadId}`,
          'user-agent': 'Mozilla/5.0'
        },
        body: JSON.stringify([{
          threadId: threadId,
          message: {
            type: 'user',
            model: 'sonnet',
            parts: [{
              type: 'rich-text',
              nodes: [{
                type: 'text',
                text: 'hi'
              }]
            }],
            timestamp: new Date().toISOString()
          }
        }])
      }
    );
    
    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Result: ${result.substring(0, 100)}`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Try 2: Using send-terragon-message endpoint
  console.log('\n2️⃣ Try send-terragon-message endpoint...');
  const response2 = await fetch(`${API_BASE}/api/send-terragon-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadId,
      message: '1+1?'
    })
  });
  const result2 = await response2.json();
  console.log('Result:', result2);
  
  // Try 3: Using execute send-message with different headers
  console.log('\n3️⃣ Try execute send-message...');
  const response3 = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-message',
      threadId: threadId,
      message: 'test'
    })
  });
  const result3 = await response3.json();
  console.log('Result:', result3);
  
  console.log(`\n🔗 Check: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);