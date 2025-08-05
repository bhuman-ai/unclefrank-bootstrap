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
  console.log('ALL MESSAGES:');
  console.log('='.repeat(70));
  
  data.messages.forEach((msg, i) => {
    console.log(`\n--- Message ${i + 1} ---`);
    console.log(msg.substring(0, 300));
    if (msg.length > 300) console.log('...(truncated)');
  });
  
  // Look for our test messages
  const testMessages = data.messages.filter((msg, i) => {
    return i > 4 || // Messages after the first 5
           msg.includes('1+1') || 
           msg.includes('test') ||
           msg.includes('hi') ||
           msg.toLowerCase().includes('test');
  });
  
  console.log('\n\nPOSSIBLE TEST MESSAGES:');
  console.log('='.repeat(70));
  testMessages.forEach((msg, i) => {
    console.log(`\nTest ${i + 1}: ${msg.substring(0, 100)}...`);
  });
}

test().catch(console.error);