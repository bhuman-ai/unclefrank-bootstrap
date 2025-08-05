#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  const threadId = process.argv[2];
  if (!threadId) {
    console.log('Usage: node test-raw-fetch.js <threadId>');
    process.exit(1);
  }
  
  console.log(`Fetching raw data for thread: ${threadId}\n`);
  
  // Use test-terragon-fetch to get parsed messages
  const response1 = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const data1 = await response1.json();
  
  console.log('=== Parsed Data ===');
  console.log(`Status: ${data1.status}`);
  console.log(`Message count: ${data1.messageCount}`);
  console.log(`Content length: ${data1.contentLength}`);
  console.log('\nMessages:');
  data1.messages.forEach((msg, i) => {
    console.log(`\n${i + 1}. ${msg}`);
  });
  
  console.log('\n=== Content Preview (first 1000 chars) ===');
  console.log(data1.contentPreview);
  
  // Also check status
  console.log('\n=== Checking Status ===');
  const response2 = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check-terragon-status',
      threadId: threadId
    })
  });
  const status = await response2.json();
  
  console.log(`Terragon status: ${status.terragonStatus}`);
  console.log(`Completed: ${status.completed}`);
  console.log(`Message count: ${status.messageCount}`);
  console.log(`URL: ${status.url}`);
}

test().catch(console.error);