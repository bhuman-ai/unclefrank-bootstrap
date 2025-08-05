#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap.vercel.app';

async function test() {
  const threadId = '89b7cedd-2b95-4335-9f48-dda99cec596e';
  
  console.log('🧪 Testing Task Decomposition for Document Management System\n');
  console.log(`Thread: ${threadId}`);
  console.log(`URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  // First, check current status
  console.log('1️⃣ Checking current messages...');
  const fetchResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const fetchData = await fetchResponse.json();
  
  console.log(`Messages: ${fetchData.messageCount}`);
  console.log(`Status: ${fetchData.status}\n`);
  
  if (fetchData.messages.length > 0) {
    console.log('Task content:');
    console.log(fetchData.messages[0].substring(0, 200) + '...\n');
  }
  
  // Force orchestrator to analyze this task
  console.log('2️⃣ Forcing orchestrator decision...');
  const decideResponse = await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'decide',
      instanceId: threadId
    })
  });
  
  if (decideResponse.ok) {
    const decision = await decideResponse.json();
    console.log('Decision:', JSON.stringify(decision, null, 2));
  } else {
    console.log('Decision failed:', decideResponse.status);
  }
  
  // Wait for processing
  console.log('\n⏳ Waiting 10s for processing...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Check for decomposition
  console.log('\n3️⃣ Checking for decomposition...');
  const checkResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const checkData = await checkResponse.json();
  
  console.log(`Final messages: ${checkData.messageCount}`);
  
  const decomp = checkData.messages.find(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('Checkpoints') ||
    msg.includes('Document Management System')
  );
  
  if (decomp) {
    console.log('\n✅ Decomposition found!');
    console.log(decomp.substring(0, 500) + '...');
  } else {
    console.log('\n❌ No decomposition found');
    
    // Try sending decomposition manually
    console.log('\n4️⃣ Sending manual decomposition...');
    const decompMessage = `# TASK DECOMPOSITION

## Task Summary
Implement Document Management System for Project.md Drafts with Validation and State Tracking

## Checkpoints (3)

### 1. Create Draft Management API
- **Objective:** Build API endpoints for draft CRUD operations
- **Blocking:** Yes
- **Instructions:**
  1. Create /api/draft-manager.js endpoint
  2. Implement create, read, update, delete operations
  3. Add draft state tracking (draft, validating, validated, failed)
  4. Store drafts with unique IDs and timestamps

### 2. Implement Validation System
- **Objective:** Connect to Terragon for real validation checks
- **Blocking:** Yes
- **Instructions:**
  1. Create validation runner that executes checks via Terragon
  2. Track validation results and errors
  3. Prevent task creation for non-validated drafts
  4. Generate validation reports

### 3. Create Draft UI Components
- **Objective:** Build UI for draft management
- **Blocking:** No
- **Instructions:**
  1. Add draft editor component
  2. Show draft status and validation results
  3. Add approve/reject buttons for validated drafts
  4. Implement merge functionality with human approval

Ready to begin implementation!`;

    const sendResponse = await fetch(`${API_BASE}/api/send-terragon-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId: threadId,
        message: decompMessage
      })
    });
    
    const sendResult = await sendResponse.json();
    console.log('Send result:', sendResult.success ? '✅ SUCCESS' : '❌ FAILED');
  }
}

test().catch(console.error);