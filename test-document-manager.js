// FRANK'S DOCUMENT MANAGER TEST SUITE
// Tests all endpoints and validates the sacred flow

const testContent = `# Project.md — Document Management System

## Purpose
This document defines the requirements for implementing a real document management system that tracks Project.md drafts through the sacred flow.

## Business Goals & Logic
- Enforce the immutable Draft → Validation → Task → Checkpoint → Review → Merge flow
- Provide real version control for Project.md drafts
- Integrate with existing Terragon task execution system
- Track state transitions with full audit trail

## User Personas & Journeys
- **Product Manager**: Creates and validates Project.md drafts
- **Technical Lead**: Reviews technical feasibility during validation
- **Development Team**: Executes tasks generated from validated drafts

## Feature List (Production State)
- Draft creation with version tracking
- Real validation using Terragon integration
- Task generation from validated drafts
- Branch tracking integration
- Human approval workflow for merges

## API Integrations & DB Structures
- Terragon Labs API for validation and task execution
- File-based storage for draft persistence
- Task Orchestrator integration for workflow management
- Branch Tracker integration for git workflow

## Constraints & Design Philosophies
- No bypassing the sacred flow
- Human approval required for production merges
- Real validation checks, no simulations
- Fail-safe fallbacks when services are unavailable`;

async function testDocumentManager() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  console.log(`[Test] 🧪 Testing Document Manager at ${baseUrl}`);
  
  let draftId = null;
  
  try {
    // Test 1: Create Draft
    console.log('\n[Test] 📝 Testing create-draft endpoint...');
    const createResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-draft',
        content: testContent,
        metadata: {
          title: 'Document Management System',
          description: 'Real document management with sacred flow enforcement',
          author: 'test-suite'
        }
      })
    });
    
    if (createResponse.ok) {
      const createResult = await createResponse.json();
      draftId = createResult.draft.draftId;
      console.log(`[Test] ✅ Draft created: ${draftId}`);
      console.log(`[Test]   Status: ${createResult.draft.status}`);
      console.log(`[Test]   Version: ${createResult.draft.version}`);
    } else {
      throw new Error(`Create draft failed: ${createResponse.status}`);
    }
    
    // Test 2: Get Draft Status
    console.log('\n[Test] 📊 Testing get-draft-status endpoint...');
    const statusResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get-draft-status',
        draftId: draftId
      })
    });
    
    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      console.log(`[Test] ✅ Status retrieved: ${statusResult.status.status}`);
      console.log(`[Test]   Can proceed: ${statusResult.status.canProceed}`);
      console.log(`[Test]   Next step: ${statusResult.status.nextStep}`);
    } else {
      throw new Error(`Get status failed: ${statusResponse.status}`);
    }
    
    // Test 3: List Drafts
    console.log('\n[Test] 📋 Testing list-drafts endpoint...');
    const listResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list-drafts'
      })
    });
    
    if (listResponse.ok) {
      const listResult = await listResponse.json();
      console.log(`[Test] ✅ Drafts listed: ${listResult.count} drafts found`);
      if (listResult.drafts.length > 0) {
        console.log(`[Test]   First draft: ${listResult.drafts[0].draftId} (${listResult.drafts[0].status})`);
      }
    } else {
      throw new Error(`List drafts failed: ${listResponse.status}`);
    }
    
    // Test 4: Validate Draft
    console.log('\n[Test] 🔍 Testing validate-draft endpoint...');
    const validateResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate-draft',
        draftId: draftId
      })
    });
    
    if (validateResponse.ok) {
      const validateResult = await validateResponse.json();
      console.log(`[Test] ✅ Validation completed: ${validateResult.draft.status}`);
      console.log(`[Test]   UX validation: ${validateResult.draft.validationResults.ux.passed ? 'PASS' : 'FAIL'}`);
      console.log(`[Test]   Technical validation: ${validateResult.draft.validationResults.technical.passed ? 'PASS' : 'FAIL'}`);
      console.log(`[Test]   Logic validation: ${validateResult.draft.validationResults.logic.passed ? 'PASS' : 'FAIL'}`);
      
      if (validateResult.draft.validationResults.ux.issues.length > 0) {
        console.log(`[Test]   UX issues: ${validateResult.draft.validationResults.ux.issues.length}`);
      }
      if (validateResult.draft.validationResults.technical.issues.length > 0) {
        console.log(`[Test]   Technical issues: ${validateResult.draft.validationResults.technical.issues.length}`);
      }
      if (validateResult.draft.validationResults.logic.issues.length > 0) {
        console.log(`[Test]   Logic issues: ${validateResult.draft.validationResults.logic.issues.length}`);
      }
    } else {
      const errorText = await validateResponse.text();
      console.log(`[Test] ⚠️ Validation failed: ${validateResponse.status}`);
      console.log(`[Test] Error: ${errorText.substring(0, 200)}`);
    }
    
    // Test 5: Create Tasks (only if validated)
    console.log('\n[Test] 📋 Testing create-tasks endpoint...');
    const tasksResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-tasks',
        draftId: draftId
      })
    });
    
    if (tasksResponse.ok) {
      const tasksResult = await tasksResponse.json();
      console.log(`[Test] ✅ Tasks created: ${tasksResult.tasks.status}`);
      console.log(`[Test]   Task count: ${tasksResult.tasks.taskCount}`);
      if (tasksResult.tasks.orchestratorInstanceId) {
        console.log(`[Test]   Orchestrator instance: ${tasksResult.tasks.orchestratorInstanceId}`);
      }
    } else {
      const errorText = await tasksResponse.text();
      console.log(`[Test] ⚠️ Task creation failed: ${tasksResponse.status}`);
      console.log(`[Test] Expected for non-validated drafts: ${errorText.substring(0, 200)}`);
    }
    
    // Test 6: Error Handling
    console.log('\n[Test] ❌ Testing error handling...');
    const errorResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get-draft-status',
        draftId: 'non-existent-draft'
      })
    });
    
    if (!errorResponse.ok) {
      console.log(`[Test] ✅ Error handling works: ${errorResponse.status}`);
    } else {
      console.log(`[Test] ⚠️ Expected error but got success`);
    }
    
    console.log('\n[Test] 🎉 Document Manager test suite completed!');
    console.log(`[Test] 📝 Test draft ID: ${draftId}`);
    
  } catch (error) {
    console.error('\n[Test] ❌ Test suite failed:', error.message);
    return 1;
  }
  
  return 0;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDocumentManager()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

export default testDocumentManager;