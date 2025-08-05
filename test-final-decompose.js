#!/usr/bin/env node

// Final test for task decomposition
const API_BASE = 'https://unclefrank-bootstrap-1emb9d16f-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Task Decomposition with Proper Timing...\n');
  
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
              text: 'Build a weather widget that shows current temperature and forecast'
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
      metadata: { type: 'main-task', task: 'Weather widget' }
    })
  });
  console.log('✅ Registered\n');
  
  // First poll - should wait
  console.log('3️⃣ First poll (expecting wait)...');
  const poll1 = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  const poll1Data = await poll1.json();
  console.log(`Instances: ${poll1Data.instanceCount}`);
  
  // Check decision
  const status1 = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'status' })
  });
  const status1Data = await status1.json();
  const lastDecision1 = status1Data.decisionHistory[status1Data.decisionHistory.length - 1];
  console.log(`Decision: ${lastDecision1?.action} - ${lastDecision1?.reasoning}\n`);
  
  // Wait for Terragon to process
  console.log('⏳ Waiting 10 seconds for Terragon to process...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Second poll - should decompose
  console.log('\n4️⃣ Second poll (expecting decomposition)...');
  const poll2 = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  const poll2Data = await poll2.json();
  
  // Check new decision
  const status2 = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'status' })
  });
  const status2Data = await status2.json();
  const lastDecision2 = status2Data.decisionHistory[status2Data.decisionHistory.length - 1];
  console.log(`Decision: ${lastDecision2?.action} - ${lastDecision2?.reasoning}\n`);
  
  // Wait for decomposition to complete
  console.log('⏳ Waiting 5 seconds for decomposition...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Check messages
  console.log('\n5️⃣ Checking for decomposition message...');
  const messagesResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const messagesData = await messagesResponse.json();
  
  console.log(`Total messages: ${messagesData.messageCount}`);
  
  // Check for decomposition
  const hasDecomposition = messagesData.messages.some(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('Checkpoint') ||
    msg.includes('## Task Summary')
  );
  
  if (hasDecomposition) {
    console.log('✅ DECOMPOSITION FOUND!');
    const decompositionMsg = messagesData.messages.find(msg => 
      msg.includes('TASK DECOMPOSITION') || msg.includes('## Task Summary')
    );
    console.log('\nDecomposition preview:');
    console.log(decompositionMsg?.substring(0, 300) + '...');
  } else {
    console.log('❌ No decomposition found');
    console.log('\nAll messages:');
    messagesData.messages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.substring(0, 100)}...`);
    });
  }
  
  console.log(`\n🔗 View task: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);