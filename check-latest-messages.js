#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  const threadId = 'c498bc3e-620f-4c70-aac5-32a6ee15f984';
  
  const response = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data = await response.json();
  
  console.log(`Total messages: ${data.messageCount}\n`);
  console.log('Last 5 messages:');
  
  // Get all messages (test-terragon-fetch only returns first 5)
  // So let's look at what we have
  data.messages.forEach((msg, i) => {
    console.log(`\n${i + 1}. ${msg}`);
  });
}

test().catch(console.error);