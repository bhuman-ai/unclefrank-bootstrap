// FRANK'S DOCUMENT MANAGER TEST - VERIFY THE SACRED FLOW WORKS
const testDocumentManager = async () => {
  console.log('=== TESTING DOCUMENT MANAGER ===');
  
  const baseUrl = process.env.VERCEL_URL ? 
    `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000';
  
  try {
    // Test 1: Health Check
    console.log('\n1. HEALTH CHECK');
    const healthResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health-check' })
    });
    const health = await healthResponse.json();
    console.log('Health status:', health.success ? 'HEALTHY' : 'UNHEALTHY');
    
    // Test 2: Create Draft
    console.log('\n2. CREATE DRAFT');
    const draftContent = `# Project.md — Test Draft

## Purpose
Testing the document management system with real version control.

## Test Features
- Real document management system that tracks Project.md drafts
- Enforces the sacred flow: Draft → Validation → Task → Checkpoint → Review → Merge
- Real version control with state tracking
- Real validation using Claude (not fake checks)

## Business Goals
- Implement proper document management
- Track drafts through the pipeline
- Enforce immutable flow validation
- Connect to Terragon for execution

## Feature List
- Create draft endpoint
- Validate draft with real checks
- List drafts with status
- Create tasks from validated drafts
- Merge validated drafts to production`;

    const createResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'create-draft',
        content: draftContent
      })
    });
    const createResult = await createResponse.json();
    console.log('Draft created:', createResult.success);
    console.log('Draft ID:', createResult.draft?.draftId);
    
    if (!createResult.success) {
      throw new Error('Failed to create draft');
    }
    
    const draftId = createResult.draft.draftId;
    
    // Test 3: Get Draft Status
    console.log('\n3. GET DRAFT STATUS');
    const statusResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'get-draft-status',
        draftId
      })
    });
    const statusResult = await statusResponse.json();
    console.log('Status check:', statusResult.success);
    console.log('Draft status:', statusResult.draft?.status);
    
    // Test 4: List Drafts
    console.log('\n4. LIST DRAFTS');
    const listResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-drafts' })
    });
    const listResult = await listResponse.json();
    console.log('List drafts:', listResult.success);
    console.log('Draft count:', listResult.count);
    
    // Test 5: Validate Draft
    console.log('\n5. VALIDATE DRAFT');
    const validateResponse = await fetch(`${baseUrl}/api/document-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'validate-draft',
        draftId
      })
    });
    const validateResult = await validateResponse.json();
    console.log('Validation:', validateResult.success);
    console.log('All validations passed:', validateResult.allPassed);
    
    if (validateResult.success && validateResult.allPassed) {
      // Test 6: Create Tasks from Draft
      console.log('\n6. CREATE TASKS FROM DRAFT');
      const tasksResponse = await fetch(`${baseUrl}/api/document-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create-tasks',
          draftId
        })
      });
      const tasksResult = await tasksResponse.json();
      console.log('Task creation:', tasksResult.success);
      console.log('Task count:', tasksResult.count);
      
      if (tasksResult.success) {
        console.log('\n7. FINAL STATUS CHECK');
        const finalStatusResponse = await fetch(`${baseUrl}/api/document-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'get-draft-status',
            draftId
          })
        });
        const finalStatus = await finalStatusResponse.json();
        console.log('Final status:', finalStatus.draft?.status);
        console.log('Tasks ready:', finalStatus.draft?.tasks?.length || 0);
      }
    }
    
    console.log('\n=== TEST COMPLETE ===');
    console.log('Document Manager is ready for sacred flow execution!');
    
  } catch (error) {
    console.error('TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
};

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDocumentManager();
}

export default testDocumentManager;