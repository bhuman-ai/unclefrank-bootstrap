#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function getAllMessages(threadId) {
  // Fetch directly from Terragon to get ALL messages
  const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
  
  const response = await fetch(
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
      body: JSON.stringify([threadId])
    }
  );

  const content = await response.text();
  
  // Extract messages from the response
  const messages = [];
  
  // Look for message array in response
  const msgMatch = content.match(/"messages":\[(.*?)\],"createdAt"/s);
  if (msgMatch) {
    try {
      const msgJson = '[' + msgMatch[1] + ']';
      const parsed = JSON.parse(msgJson);
      parsed.forEach(msg => {
        if (msg.parts?.[0]?.nodes?.[0]?.text) {
          messages.push(msg.parts[0].nodes[0].text);
        }
      });
    } catch (e) {
      // Fallback to text extraction
    }
  }
  
  // Fallback: extract text directly
  if (messages.length === 0) {
    const textMatches = [...content.matchAll(/"text":"([^"]+)"/g)];
    textMatches.forEach(match => {
      messages.push(match[1]);
    });
  }
  
  return messages;
}

async function test() {
  console.log('🧪 Complete Task Orchestrator Flow Test\n');
  
  // Step 1: Create a new task
  console.log('1️⃣ Creating new task...');
  const createResponse = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-task',
      payload: [{
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
        },
        githubRepoFullName: 'bhuman-ai/unclefrank-bootstrap',
        repoBaseBranchName: 'master',
        saveAsDraft: false
      }]
    })
  });
  
  const { threadId } = await createResponse.json();
  console.log(`✅ Created: ${threadId}`);
  console.log(`🔗 URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Step 2: Wait and send test message
  console.log('⏳ Waiting 10s for Terragon...');
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n2️⃣ Sending test message...');
  const sendResponse = await fetch(`${API_BASE}/api/send-terragon-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadId,
      message: '1+1?'
    })
  });
  const sendResult = await sendResponse.json();
  console.log('Send result:', sendResult.success ? '✅ SUCCESS' : '❌ FAILED');
  if (!sendResult.success) {
    console.log('Error details:', sendResult);
  }
  
  // Step 3: Check messages
  console.log('\n⏳ Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('\n3️⃣ Checking messages...');
  const messages = await getAllMessages(threadId);
  
  console.log(`Total messages: ${messages.length}\n`);
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg}`);
  });
  
  // Verify our test message was sent
  const testMsg = messages.find(m => m.includes('1+1'));
  if (testMsg) {
    console.log('\n✅ ✅ ✅ MESSAGE SENDING WORKS! ✅ ✅ ✅');
    console.log('The send-terragon-message endpoint successfully sends messages!');
  } else {
    console.log('\n❌ Test message not found');
  }
  
  console.log(`\n🔗 Verify at: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);