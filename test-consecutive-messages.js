#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function sendMessageViaExecute(threadId, message) {
  console.log(`📤 Sending via execute API: "${message.substring(0, 50)}..."`);
  const response = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-message',
      threadId: threadId,
      message: message
    })
  });
  
  const result = await response.json();
  console.log(`Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  if (!result.success) {
    console.log('Error:', result.error || result.details);
  }
  return result.success;
}

async function test() {
  // Use the thread you just created
  const threadId = 'e1bf8f98-9ef0-4612-bd71-d8496667af0a';
  
  console.log('🧪 Testing Consecutive Messages\n');
  console.log(`Thread: ${threadId}`);
  console.log(`URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Get initial message count
  console.log('📊 Getting initial state...');
  const response1 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data1 = await response1.json();
  console.log(`Initial messages: ${data1.messageCount}\n`);
  
  // Send first message
  console.log('1️⃣ FIRST MESSAGE:');
  const msg1 = "Hi! This is the first test message sent at " + new Date().toISOString();
  await sendMessageViaExecute(threadId, msg1);
  
  // Wait a bit
  console.log('\n⏳ Waiting 3 seconds...\n');
  await new Promise(r => setTimeout(r, 3000));
  
  // Send second message
  console.log('2️⃣ SECOND MESSAGE:');
  const msg2 = "And this is the second test message sent at " + new Date().toISOString();
  await sendMessageViaExecute(threadId, msg2);
  
  // Wait for messages to process
  console.log('\n⏳ Waiting 10 seconds for Terragon to process...\n');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check final state
  console.log('📊 Checking final state...');
  const response2 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data2 = await response2.json();
  console.log(`Final messages: ${data2.messageCount}`);
  console.log(`New messages added: ${data2.messageCount - data1.messageCount}\n`);
  
  console.log('📝 All messages:');
  data2.messages.forEach((msg, i) => {
    console.log(`\n--- Message ${i + 1} ---`);
    console.log(msg.substring(0, 200));
    if (msg.length > 200) console.log('...');
  });
  
  console.log(`\n🔗 CHECK THE THREAD: https://www.terragonlabs.com/task/${threadId}`);
  console.log('\nIf you see the two test messages there, then sending works!');
}

test().catch(console.error);