#!/usr/bin/env node

// Simple test for task decomposition
const API_BASE = 'https://unclefrank-bootstrap-gg040p5qa-bhuman.vercel.app';

async function testDecompose() {
  console.log('🧪 Testing Task Decomposition...\n');
  
  // Create a fresh task
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
              text: 'Build a calculator component with add, subtract, multiply, and divide functions'
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
      metadata: { type: 'main-task', task: 'Calculator component' }
    })
  });
  console.log('✅ Registered\n');
  
  // Wait for Terragon
  console.log('⏳ Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Poll to trigger decomposition
  console.log('3️⃣ Polling orchestrator...');
  const pollResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  const pollData = await pollResponse.json();
  console.log('Poll result:', JSON.stringify(pollData, null, 2));
  
  // Wait for decomposition
  console.log('\n⏳ Waiting 10 seconds for decomposition...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check messages
  console.log('\n4️⃣ Checking messages...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  console.log(`Message count: ${messagesData.messageCount}`);
  console.log('\nMessages:');
  messagesData.messages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg.substring(0, 100)}...`);
  });
  
  // Check if decomposition message exists
  const hasDecomposition = messagesData.messages.some(msg => 
    msg.includes('TASK DECOMPOSITION') || msg.includes('Checkpoint')
  );
  console.log(`\n✅ Has decomposition: ${hasDecomposition}`);
  
  console.log(`\n🔗 View task: https://www.terragonlabs.com/task/${threadId}`);
}

testDecompose().catch(console.error);