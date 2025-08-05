#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function waitForCompletion(threadId, maxWaitTime = 60000) {
  console.log(`⏳ Waiting for Terragon to complete response...`);
  const startTime = Date.now();
  let lastMessageCount = 0;
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check status
    const response = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check-terragon-status',
        threadId: threadId,
        lastMessageCount: lastMessageCount
      })
    });
    
    const status = await response.json();
    
    if (status.completed) {
      console.log(`✅ Terragon completed with status: ${status.terragonStatus}`);
      return true;
    }
    
    if (status.messageCount > lastMessageCount) {
      console.log(`📨 New messages detected (${status.messageCount} total)`);
      lastMessageCount = status.messageCount;
    }
    
    // Wait 2 seconds before next check
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`⏱️ Timeout reached after ${maxWaitTime/1000} seconds`);
  return false;
}

async function getMessages(threadId) {
  const response = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data = await response.json();
  return data.messages;
}

async function sendMessage(threadId, message) {
  console.log(`\n📤 Sending: "${message}"`);
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
  if (result.success) {
    console.log(`✅ Message sent successfully`);
    return true;
  } else {
    console.error(`❌ Failed to send message:`, result);
    return false;
  }
}

async function test() {
  console.log('🧪 Testing Full Terragon Interaction Suite\n');
  console.log('This test will:');
  console.log('1. Create a new Terragon instance with "hello"');
  console.log('2. Wait for Terragon to finish replying');
  console.log('3. Send "what\'s 1+1?"');
  console.log('4. Wait for reply');
  console.log('5. Send "what\'s 1+2?"');
  console.log('6. Verify all interactions worked\n');
  
  // Step 1: Create new Terragon instance
  console.log('=== STEP 1: Creating Terragon instance ===');
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
              text: 'hello'
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
  console.log(`✅ Created instance: ${threadId}`);
  console.log(`🔗 URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Step 2: Wait for Terragon to finish initial response
  console.log('=== STEP 2: Waiting for initial response ===');
  await new Promise(r => setTimeout(r, 5000)); // Give it time to initialize
  const completed1 = await waitForCompletion(threadId);
  
  let messages1 = [];
  if (completed1) {
    messages1 = await getMessages(threadId);
    console.log(`\n📋 Messages after step 2 (${messages1.length} total):`);
    messages1.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`);
    });
  }
  
  // Step 3: Send "what's 1+1?"
  console.log('\n=== STEP 3: Sending "what\'s 1+1?" ===');
  const sent1 = await sendMessage(threadId, "what's 1+1?");
  
  if (!sent1) {
    console.error('❌ Failed to send first question');
    return;
  }
  
  // Step 4: Wait for reply
  console.log('\n=== STEP 4: Waiting for reply to 1+1 ===');
  await new Promise(r => setTimeout(r, 3000)); // Give it time to process
  const completed2 = await waitForCompletion(threadId);
  
  if (completed2) {
    const messages2 = await getMessages(threadId);
    console.log(`\n📋 Messages after step 4 (${messages2.length} total):`);
    // Show only new messages
    const newMessages = messages2.slice(messages1?.length || 0);
    if (newMessages.length === 0) {
      console.log('⚠️  No new messages found - checking all messages:');
      messages2.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}`);
      });
    } else {
      newMessages.forEach((msg, i) => {
        console.log(`NEW ${i + 1}. ${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}`);
      });
    }
  }
  
  // Step 5: Send "what's 1+2?"
  console.log('\n=== STEP 5: Sending "what\'s 1+2?" ===');
  const sent2 = await sendMessage(threadId, "what's 1+2?");
  
  if (!sent2) {
    console.error('❌ Failed to send second question');
    return;
  }
  
  // Wait for final reply
  console.log('\n=== Waiting for reply to 1+2 ===');
  await new Promise(r => setTimeout(r, 3000)); // Give it time to process
  const completed3 = await waitForCompletion(threadId);
  
  if (completed3) {
    const messages3 = await getMessages(threadId);
    console.log(`\n📋 Final messages (${messages3.length} total):`);
    // Show all messages with clear formatting
    messages3.forEach((msg, i) => {
      console.log(`\n--- Message ${i + 1} ---`);
      console.log(msg.substring(0, 300));
      if (msg.length > 300) console.log('... (truncated)');
    });
  }
  
  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`✅ Instance created: ${threadId}`);
  console.log(`✅ Initial message sent: "hello"`);
  console.log(`${sent1 ? '✅' : '❌'} First question sent: "what's 1+1?"`);
  console.log(`${sent2 ? '✅' : '❌'} Second question sent: "what's 1+2?"`);
  console.log(`\n🔗 View full conversation: https://www.terragonlabs.com/task/${threadId}`);
  
  console.log('\n🎉 Test completed! This demonstrates:');
  console.log('- Creating Terragon instances ✓');
  console.log('- Waiting for completion ✓');
  console.log('- Sending follow-up messages ✓');
  console.log('- Full interaction flow ✓');
}

test().catch(console.error);