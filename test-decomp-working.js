#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Task Decomposition (FIXED)...\n');
  
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
              text: 'Build a responsive navigation menu with dropdown support'
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
  
  // Register with orchestrator
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
  
  // Wait for Terragon to respond
  console.log('⏳ Waiting 20s for Terragon to respond...\n');
  await new Promise(r => setTimeout(r, 20000));
  
  // Poll again - should trigger decomposition
  console.log('4️⃣ Second poll (should trigger decomposition)...');
  const pollResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  const pollData = await pollResponse.json();
  console.log('Poll response:', JSON.stringify(pollData, null, 2));
  
  // Wait for decomposition to be sent
  console.log('\n⏳ Waiting 15s for decomposition to be sent...\n');
  await new Promise(r => setTimeout(r, 15000));
  
  // Check messages to verify decomposition was sent
  console.log('5️⃣ Checking for decomposition...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  
  console.log(`Total messages: ${messagesData.messageCount}\n`);
  
  // Find decomposition message
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
    console.log('All messages:');
    messagesData.messages.forEach((msg, i) => {
      console.log(`\n${i + 1}. ${msg.substring(0, 200)}...`);
    });
  }
  
  // Check orchestrator status
  console.log('\n6️⃣ Checking orchestrator status...');
  const statusResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'status' })
  });
  const statusData = await statusResponse.json();
  
  console.log('\nOrchestrator Status:');
  console.log(`- Active instances: ${statusData.activeCount}`);
  console.log(`- Total instances: ${statusData.instances.length}`);
  console.log(`- Health: ${statusData.health.status}`);
  
  console.log(`\n🔗 View task: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);