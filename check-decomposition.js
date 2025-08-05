#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  const threadId = '4e08841a-5adb-4962-bd7b-42efd5c125e2';
  
  const response = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data = await response.json();
  
  console.log(`Total messages: ${data.messageCount}\n`);
  
  // Look for decomposition
  let found = false;
  data.messages.forEach((msg, i) => {
    if (msg.includes('TASK DECOMPOSITION') || 
        msg.includes('Checkpoints') ||
        msg.includes('## Task Summary')) {
      console.log(`\n✅ ✅ ✅ DECOMPOSITION FOUND AT MESSAGE ${i + 1}! ✅ ✅ ✅\n`);
      console.log(msg);
      found = true;
    }
  });
  
  if (!found) {
    console.log('❌ No decomposition found in messages\n');
    console.log('All messages:');
    data.messages.forEach((msg, i) => {
      console.log(`\n${i + 1}. ${msg.substring(0, 100)}...`);
    });
  }
  
  console.log(`\n🔗 https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);