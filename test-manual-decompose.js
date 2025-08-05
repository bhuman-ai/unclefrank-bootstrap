#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  const threadId = '4e08841a-5adb-4962-bd7b-42efd5c125e2';
  
  console.log('🧪 Manually triggering decomposition...\n');
  
  // Force a decision on this specific instance
  console.log('Forcing orchestrator decision...');
  const response = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'decide',
      instanceId: threadId
    })
  });
  
  const result = await response.json();
  console.log('Decision result:', JSON.stringify(result, null, 2));
  
  // Wait for processing
  console.log('\n⏳ Waiting 10s...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check messages
  const msgResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const msgData = await msgResponse.json();
  
  console.log(`\nTotal messages: ${msgData.messageCount}`);
  
  // Look for decomposition in last few messages
  const lastMessages = msgData.messages.slice(-5);
  lastMessages.forEach((msg, i) => {
    console.log(`\nMessage ${msgData.messages.length - 5 + i + 1}: ${msg.substring(0, 150)}...`);
  });
}

test().catch(console.error);