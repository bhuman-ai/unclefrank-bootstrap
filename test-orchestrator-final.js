#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Task Orchestrator Decomposition (FINAL)\n');
  
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
              text: 'Create a login form'
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
  console.log(`✅ Created: ${threadId}`);
  console.log(`🔗 URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Register with orchestrator
  console.log('2️⃣ Registering with orchestrator...');
  const regResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      instanceId: threadId,
      metadata: { type: 'main-task' }
    })
  });
  console.log('Registration:', await regResponse.json());
  
  // Wait for Terragon to respond
  console.log('\n⏳ Waiting 20s for Terragon to respond...');
  await new Promise(r => setTimeout(r, 20000));
  
  // Poll - should trigger decomposition
  console.log('\n3️⃣ Polling orchestrator...');
  const pollResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  const pollData = await pollResponse.json();
  console.log('Poll result:', JSON.stringify(pollData, null, 2));
  
  // Wait for decomposition
  console.log('\n⏳ Waiting 20s for decomposition...');
  await new Promise(r => setTimeout(r, 20000));
  
  // Check messages
  console.log('\n4️⃣ Checking messages...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  
  console.log(`\nTotal messages: ${messagesData.messageCount}`);
  
  // Look for decomposition
  const decomp = messagesData.messages.find(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('Checkpoints') ||
    msg.includes('## Task Summary')
  );
  
  if (decomp) {
    console.log('\n✅ ✅ ✅ DECOMPOSITION SUCCESSFUL! ✅ ✅ ✅\n');
    console.log('Decomposition found in messages!');
  } else {
    console.log('\n❌ No decomposition found');
    console.log('\nLast 3 messages:');
    messagesData.messages.slice(-3).forEach((msg, i) => {
      console.log(`\n${i + 1}. ${msg.substring(0, 150)}...`);
    });
  }
  
  console.log(`\n🔗 Check thread: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);