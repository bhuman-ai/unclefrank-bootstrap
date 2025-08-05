#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';

async function test() {
  console.log('🧪 Testing Task Decomposition RIGHT NOW...\n');
  
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
              text: 'Create a simple todo list component'
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
  
  // Wait a bit
  console.log('⏳ Waiting 10s for Terragon to respond...');
  await new Promise(r => setTimeout(r, 10000));
  
  // Send decomposition message directly
  console.log('\n2️⃣ Sending decomposition message...');
  const decompositionMessage = `# TASK DECOMPOSITION

## Task Summary
Create a simple todo list component with add/remove functionality

## Checkpoints (3)

### 1. Create TodoList Component Structure
- **Objective:** Set up the basic component structure
- **Blocking:** Yes
- **Instructions:**
  1. Create TodoList.js component file
  2. Set up React component with state for todos
  3. Create basic JSX structure

### 2. Implement Add Todo Functionality  
- **Objective:** Allow users to add new todos
- **Blocking:** Yes
- **Instructions:**
  1. Add input field for new todo text
  2. Add "Add Todo" button
  3. Implement addTodo function to update state

### 3. Implement Remove Todo Functionality
- **Objective:** Allow users to remove todos
- **Blocking:** No
- **Instructions:**
  1. Add delete button to each todo item
  2. Implement removeTodo function
  3. Test the complete functionality

Ready to begin execution!`;

  const sendResponse = await fetch(`${API_BASE}/api/send-terragon-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      threadId: threadId,
      message: decompositionMessage
    })
  });
  
  const sendResult = await sendResponse.json();
  console.log('Send result:', sendResult);
  
  // Wait and check
  console.log('\n⏳ Waiting 5s for message to appear...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Fetch messages
  console.log('\n3️⃣ Checking messages...');
  const fetchResponse = await fetch(`${API_BASE}/api/test-terragon-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId })
  });
  const fetchData = await fetchResponse.json();
  
  console.log(`\nTotal messages: ${fetchData.messageCount}`);
  
  const decomp = fetchData.messages.find(msg => 
    msg.includes('TASK DECOMPOSITION') || 
    msg.includes('Checkpoints')
  );
  
  if (decomp) {
    console.log('\n✅ ✅ ✅ DECOMPOSITION SENT SUCCESSFULLY! ✅ ✅ ✅');
    console.log('\nYou can see it at:');
    console.log(`🔗 https://www.terragonlabs.com/task/${threadId}`);
  } else {
    console.log('\n❌ Decomposition not found in messages');
    console.log('Last 3 messages:');
    fetchData.messages.slice(-3).forEach((msg, i) => {
      console.log(`\n${i + 1}. ${msg.substring(0, 150)}...`);
    });
  }
  
  console.log(`\n🔗 CHECK THIS LINK: https://www.terragonlabs.com/task/${threadId}`);
}

test().catch(console.error);