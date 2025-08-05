#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Task Decomposition (FINAL)...\n');
  
  // Create task
  console.log('1️⃣ Creating task...');
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
              text: 'Create a search component with autocomplete functionality'
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
  
  const { threadId } = await createResponse.json();
  console.log(`✅ Created: ${threadId}\n`);
  
  // Register
  console.log('2️⃣ Registering with orchestrator...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      instanceId: threadId,
      metadata: { type: 'main-task' }
    })
  });
  
  // Poll immediately (will wait)
  console.log('3️⃣ First poll...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  // Wait for Terragon
  console.log('⏳ Waiting 15s for Terragon to respond...\n');
  await new Promise(r => setTimeout(r, 15000));
  
  // Poll again - should decompose
  console.log('4️⃣ Second poll (should trigger decomposition)...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  // Wait for decomposition
  console.log('⏳ Waiting 10s for decomposition...\n');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check messages
  console.log('5️⃣ Checking for decomposition...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  
  console.log(`Total messages: ${messagesData.messageCount}\n`);
  
  // Find decomposition
  const decomp = messagesData.messages.find(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('## Task Summary') ||
    msg.includes('## Checkpoints')
  );
  
  if (decomp) {
    console.log('✅ ✅ ✅ DECOMPOSITION SUCCESSFUL! ✅ ✅ ✅\n');
    console.log('Decomposition Message:');
    console.log('='.repeat(60));
    console.log(decomp);
    console.log('='.repeat(60));
  } else {
    console.log('❌ No decomposition found\n');
    console.log('Last 3 messages:');
    messagesData.messages.slice(-3).forEach((msg, i) => {
      console.log(`\n${messagesData.messages.length - 2 + i}. ${msg.substring(0, 150)}...`);
    });
  }
  
  console.log(`\n🔗 View task: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);