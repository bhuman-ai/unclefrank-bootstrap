#!/usr/bin/env node

// Test script for Task Orchestrator
const API_BASE = 'https://unclefrank-bootstrap-lmqevwtt2-bhuman.vercel.app';

async function testOrchestrator() {
  console.log('🧪 Testing Task Orchestrator...\n');
  
  // Step 1: Create a task
  console.log('1️⃣ Creating task in Terragon...');
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
              text: 'Create a simple REST API endpoint that returns "Hello from Uncle Frank" as JSON'
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
  
  const createData = await createResponse.json();
  console.log('✅ Task created:', createData);
  
  if (!createData.threadId) {
    console.error('❌ Failed to create task');
    return;
  }
  
  const threadId = createData.threadId;
  console.log(`📍 Thread ID: ${threadId}`);
  console.log(`🔗 URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Step 2: Register with orchestrator
  console.log('2️⃣ Registering with orchestrator...');
  const registerResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      instanceId: threadId,
      metadata: {
        type: 'main-task',
        task: 'Create Hello World API endpoint',
        branch: 'master'
      }
    })
  });
  
  const registerData = await registerResponse.json();
  console.log('✅ Registered:', registerData);
  
  // Step 3: Wait a bit for Terragon to process
  console.log('\n⏳ Waiting 5 seconds for Terragon to process...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 4: Poll orchestrator
  console.log('\n3️⃣ Polling orchestrator...');
  const pollResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  const pollData = await pollResponse.json();
  console.log('✅ Poll result:', JSON.stringify(pollData, null, 2));
  
  // Step 5: Check status
  console.log('\n4️⃣ Checking orchestrator status...');
  const statusResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'status' })
  });
  
  const statusData = await statusResponse.json();
  console.log('✅ Status:', JSON.stringify(statusData, null, 2));
  
  // Step 6: Force a decision
  console.log('\n5️⃣ Forcing orchestrator decision...');
  const decideResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'decide',
      instanceId: threadId
    })
  });
  
  const decideData = await decideResponse.json();
  console.log('✅ Decision:', JSON.stringify(decideData, null, 2));
  
  console.log('\n✅ Test complete! Check the Terragon thread for decomposition.');
}

testOrchestrator().catch(console.error);