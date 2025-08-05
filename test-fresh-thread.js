#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Message Sending on Fresh Thread\n');
  
  // Create a brand new thread
  console.log('1️⃣ Creating new thread...');
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
              text: 'Just say "ready" and nothing else'
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
  
  const createData = await createResponse.json();
  const threadId = createData.threadId;
  console.log(`✅ Created: ${threadId}`);
  console.log(`🔗 URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Wait for initial response
  console.log('⏳ Waiting 15s for Terragon to respond...');
  await new Promise(r => setTimeout(r, 15000));
  
  // Check initial state
  console.log('\n2️⃣ Checking initial state...');
  const fetch1 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data1 = await fetch1.json();
  console.log(`Messages: ${data1.messageCount}`);
  console.log('Messages:', data1.messages.map((m, i) => `${i+1}. ${m.substring(0, 50)}...`).join('\n'));
  
  // Send test message using send-terragon-message
  console.log('\n3️⃣ Sending test message via send-terragon-message...');
  const sendResponse1 = await fetch(`${API_BASE}/api/send-terragon-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadId,
      message: 'TEST 1: This is sent via send-terragon-message endpoint'
    })
  });
  const sendResult1 = await sendResponse1.json();
  console.log('Result:', sendResult1);
  
  // Wait
  console.log('\n⏳ Waiting 10s...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Send test message using execute send-message
  console.log('\n4️⃣ Sending test message via execute send-message...');
  const sendResponse2 = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-message',
      threadId: threadId,
      message: 'TEST 2: This is sent via execute send-message action'
    })
  });
  const sendResult2 = await sendResponse2.json();
  console.log('Result:', sendResult2);
  
  // Final wait
  console.log('\n⏳ Waiting 10s for processing...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check final state
  console.log('\n5️⃣ Checking final state...');
  const fetch2 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data2 = await fetch2.json();
  console.log(`Final messages: ${data2.messageCount}`);
  console.log(`New messages: ${data2.messageCount - data1.messageCount}`);
  
  console.log('\nAll messages:');
  data2.messages.forEach((msg, i) => {
    console.log(`\n--- Message ${i + 1} ---`);
    console.log(msg);
  });
  
  console.log(`\n\n🔗 PLEASE CHECK: https://www.terragonlabs.com/task/${threadId}`);
  console.log('Do you see the test messages in the Terragon UI?');
}

test().catch(console.error);