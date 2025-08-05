#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  const threadId = '4e08841a-5adb-4962-bd7b-42efd5c125e2';
  
  console.log('📤 Sending decomposition to thread:', threadId);
  
  const decompositionMessage = `# TASK DECOMPOSITION

## Task Summary
Create a login form with email/password fields

## Checkpoints (3)

### 1. Create LoginForm Component
- **Objective:** Set up the basic component structure
- **Blocking:** Yes
- **Instructions:**
  1. Create LoginForm component
  2. Add form structure with email/password inputs
  3. Style with Tailwind CSS

### 2. Add Form Validation
- **Objective:** Validate user inputs
- **Blocking:** Yes
- **Instructions:**
  1. Add email validation
  2. Add password requirements
  3. Show error messages

### 3. Handle Form Submission
- **Objective:** Process form submission
- **Blocking:** No
- **Instructions:**
  1. Add submit handler
  2. Show loading state
  3. Handle success/error

Ready to execute!`;

  const response = await fetch(`${API_BASE}/api/send-terragon-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadId,
      message: decompositionMessage
    })
  });
  
  const result = await response.json();
  console.log('\nResult:', result);
  
  if (result.success) {
    console.log('\n✅ Decomposition sent successfully!');
    console.log(`🔗 Check: https://www.terragonlabs.com/task/${threadId}`);
  } else {
    console.log('\n❌ Failed to send decomposition');
  }
}

test().catch(console.error);