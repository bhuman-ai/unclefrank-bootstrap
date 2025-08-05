#!/usr/bin/env node

// Direct test of decomposition
const API_BASE = 'https://unclefrank-bootstrap-644z5ef4o-bhuman.vercel.app';

async function test() {
  console.log('🧪 Direct Decomposition Test...\n');
  
  // Use the existing task
  const threadId = 'b22da0a5-7e06-4760-b4a3-ac0e439420e1';
  
  // Force a decision
  console.log('1️⃣ Forcing orchestrator decision...');
  const decideResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'decide',
      instanceId: threadId
    })
  });
  
  const decideData = await decideResponse.json();
  console.log('Response:', JSON.stringify(decideData, null, 2));
  
  // Wait a bit
  console.log('\n⏳ Waiting 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check messages
  console.log('\n2️⃣ Checking messages...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  
  const messagesData = await messagesResponse.json();
  console.log(`Total messages: ${messagesData.messageCount}`);
  
  // Look for decomposition
  const hasDecomp = messagesData.messages.some(msg => 
    msg.includes('DECOMPOSITION') || 
    msg.includes('checkpoint') || 
    msg.includes('Checkpoint')
  );
  
  console.log(`Has decomposition: ${hasDecomp}`);
  
  if (!hasDecomp) {
    console.log('\n3️⃣ Checking Vercel logs...');
    console.log('Visit: https://vercel.com/bhuman/unclefrank-bootstrap/BdUyXQUXbJrjFeVhNf2pJyNFdTRu/functions');
    console.log('Look for:');
    console.log('- [Orchestrator] 🧠 TASK DECOMPOSITION STARTING');
    console.log('- [Orchestrator] 📤 SENDING decomposition');
    console.log('- Any error messages');
  }
}

test().catch(console.error);