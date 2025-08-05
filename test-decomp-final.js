#!/usr/bin/env node

// Final decomposition test
const API_BASE = 'https://unclefrank-bootstrap-e4n9nj2gz-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Fixed Decomposition...\n');
  
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
              text: 'Build a login form with email and password validation'
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
  console.log('2️⃣ Registering...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      instanceId: threadId,
      metadata: { type: 'main-task' }
    })
  });
  
  // Wait for context
  console.log('⏳ Waiting 10s for Terragon...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Poll - should decompose
  console.log('\n3️⃣ Polling (should trigger decomposition)...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  // Wait for decomposition
  console.log('⏳ Waiting 8s for decomposition...');
  await new Promise(r => setTimeout(r, 8000));
  
  // Check messages
  console.log('\n4️⃣ Checking messages...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  
  // Find decomposition
  const decomp = messagesData.messages.find(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('## Task Summary') ||
    msg.includes('## Checkpoints')
  );
  
  if (decomp) {
    console.log('\n✅ DECOMPOSITION FOUND!\n');
    console.log('Preview:');
    console.log('='.repeat(60));
    console.log(decomp.substring(0, 800));
    console.log('='.repeat(60));
  } else {
    console.log('\n❌ No decomposition found');
    console.log('Messages:', messagesData.messages.length);
  }
  
  console.log(`\n🔗 https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);