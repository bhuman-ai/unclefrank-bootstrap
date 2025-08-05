#!/usr/bin/env node

// Test working decomposition
const API_BASE = 'https://unclefrank-bootstrap-644z5ef4o-bhuman.vercel.app';

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
              text: 'Create a user profile component with avatar, name, and bio'
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
  console.log('✅ Registered\n');
  
  // Wait for Terragon to start
  console.log('⏳ Waiting 8 seconds for Terragon to respond...');
  await new Promise(r => setTimeout(r, 8000));
  
  // Poll - should trigger decomposition
  console.log('3️⃣ Polling orchestrator...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  // Check decision
  const statusResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'status' })
  });
  const statusData = await statusResponse.json();
  const lastDecision = statusData.decisionHistory[statusData.decisionHistory.length - 1];
  console.log(`Decision: ${lastDecision?.action} - ${lastDecision?.reasoning}\n`);
  
  // Wait for decomposition
  console.log('⏳ Waiting 5 seconds for decomposition message...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Check messages
  console.log('4️⃣ Checking for decomposition...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  
  console.log(`Total messages: ${messagesData.messageCount}`);
  
  const decompositionMsg = messagesData.messages.find(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('## Task Summary') ||
    msg.includes('Checkpoint')
  );
  
  if (decompositionMsg) {
    console.log('\n✅ DECOMPOSITION FOUND!\n');
    console.log('Preview:');
    console.log('=' .repeat(60));
    console.log(decompositionMsg.substring(0, 500) + '...');
    console.log('=' .repeat(60));
  } else {
    console.log('\n❌ No decomposition found');
  }
  
  console.log(`\n🔗 View full task: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);