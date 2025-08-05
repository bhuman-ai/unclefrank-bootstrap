#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Message Send Capability\n');
  
  // Use an existing thread or create new one
  const threadId = process.argv[2] || 'c498bc3e-620f-4c70-aac5-32a6ee15f984';
  
  console.log(`Using thread: ${threadId}`);
  console.log(`URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Get initial state
  console.log('1️⃣ Getting initial message count...');
  const response1 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data1 = await response1.json();
  console.log(`Initial messages: ${data1.messageCount}`);
  
  // Send a message
  const testMessage = `Test message sent at ${new Date().toISOString()}`;
  console.log(`\n2️⃣ Sending message: "${testMessage}"`);
  
  const sendResponse = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-message',
      threadId: threadId,
      message: testMessage
    })
  });
  
  const sendResult = await sendResponse.json();
  console.log('Send result:', JSON.stringify(sendResult, null, 2));
  
  // Wait and check again
  console.log('\n3️⃣ Waiting 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Get updated state
  console.log('\n4️⃣ Getting updated message count...');
  const response2 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data2 = await response2.json();
  console.log(`Updated messages: ${data2.messageCount}`);
  
  if (data2.messageCount > data1.messageCount) {
    console.log('✅ New messages detected!');
    console.log('\nNew messages:');
    const newMessages = data2.messages.slice(data1.messageCount);
    newMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg}`);
    });
  } else {
    console.log('❌ No new messages detected');
    console.log('\nAll messages:');
    data2.messages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.substring(0, 200)}...`);
    });
  }
  
  // Try the send-terragon-message endpoint instead
  console.log('\n5️⃣ Trying alternative send endpoint...');
  const altResponse = await fetch(`${API_BASE}/api/send-terragon-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadId,
      message: 'Alternative send test'
    })
  });
  
  const altResult = await altResponse.json();
  console.log('Alternative send result:', JSON.stringify(altResult, null, 2));
  
  console.log(`\n🔗 Check the thread: https://www.terragonlabs.com/task/${threadId}`);
  console.log('If messages appear there but not in our fetch, it\'s a session/auth issue.');
}

test().catch(console.error);