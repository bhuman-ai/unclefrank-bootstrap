#!/usr/bin/env node

// FRANK'S DOCUMENT MANAGEMENT SYSTEM TEST

const API_BASE = 'https://unclefrank-bootstrap-lkpezw1mb-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Document Management System\n');
  
  // Test 1: Create a draft
  console.log('1️⃣ Creating a new draft...');
  const createResponse = await fetch(`${API_BASE}/api/draft-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      content: `## Task: Implement User Authentication System

## Acceptance Criteria:
- [ ] Users can register with email and password
- [ ] Users can login and receive JWT tokens
- [ ] Protected routes require valid tokens
- [ ] Token refresh mechanism implemented

## Technical Details:
- Use bcrypt for password hashing
- JWT tokens with 1 hour expiry
- Refresh tokens with 7 day expiry
- Store users in PostgreSQL database`,
      metadata: {
        author: 'test-script',
        source: 'test'
      }
    })
  });
  
  if (!createResponse.ok) {
    console.error('❌ Failed to create draft:', createResponse.status);
    return;
  }
  
  const { draft } = await createResponse.json();
  console.log(`✅ Created draft: ${draft.id}`);
  console.log(`   State: ${draft.state}`);
  
  // Test 2: List drafts
  console.log('\n2️⃣ Listing all drafts...');
  const listResponse = await fetch(`${API_BASE}/api/draft-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' })
  });
  
  if (listResponse.ok) {
    const { drafts } = await listResponse.json();
    console.log(`✅ Found ${drafts.length} drafts`);
    drafts.forEach(d => {
      console.log(`   - ${d.id}: ${d.state}`);
    });
  }
  
  // Test 3: Validate draft (this will create a Terragon task)
  console.log('\n3️⃣ Starting validation...');
  const validateResponse = await fetch(`${API_BASE}/api/validation-runner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'validate',
      draftId: draft.id,
      draftContent: draft.content
    })
  });
  
  if (!validateResponse.ok) {
    console.error('❌ Failed to start validation:', validateResponse.status);
    return;
  }
  
  const validationData = await validateResponse.json();
  console.log(`✅ Validation started`);
  console.log(`   Thread ID: ${validationData.validationThreadId}`);
  console.log(`   Monitor at: ${validationData.monitorUrl}`);
  
  // Test 4: Check validation status
  console.log('\n4️⃣ Checking validation status...');
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
  
  const statusResponse = await fetch(`${API_BASE}/api/validation-runner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'check-status',
      validationThreadId: validationData.validationThreadId
    })
  });
  
  if (statusResponse.ok) {
    const statusData = await statusResponse.json();
    console.log(`✅ Validation status: ${statusData.status}`);
    console.log(`   Completed: ${statusData.completed}`);
    
    if (statusData.validationResults) {
      console.log(`   Results: ${statusData.validationResults.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   Summary: ${statusData.validationResults.summary}`);
    }
  }
  
  // Test 5: Update draft state
  console.log('\n5️⃣ Updating draft state...');
  const updateStateResponse = await fetch(`${API_BASE}/api/draft-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'validate',
      draftId: draft.id
    })
  });
  
  if (updateStateResponse.ok) {
    const updateData = await updateStateResponse.json();
    console.log(`✅ Draft state updated to: ${updateData.draft.state}`);
  }
  
  // Test 6: Get draft history
  console.log('\n6️⃣ Getting draft history...');
  const historyResponse = await fetch(`${API_BASE}/api/draft-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'history',
      draftId: draft.id
    })
  });
  
  if (historyResponse.ok) {
    const { history } = await historyResponse.json();
    console.log(`✅ Draft history (${history.length} events):`);
    history.forEach(event => {
      console.log(`   - ${event.action}: ${event.state} at ${new Date(event.timestamp).toLocaleTimeString()}`);
    });
  }
  
  console.log('\n✨ Document Management System test complete!');
  console.log('🔗 Check the UI to see the draft and continue the sacred flow');
}

test().catch(console.error);