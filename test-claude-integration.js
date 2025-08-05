#!/usr/bin/env node

// FRANK'S CLAUDE INTEGRATION TEST
// Tests the complete autonomous software dev flow with Claude

const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';
const API_BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'https://unclefrank-bootstrap.vercel.app';

async function test() {
  console.log('🔨 Testing Uncle Frank Autonomous Dev System with Claude\n');
  
  // Test 1: Claude Health Check
  console.log('1️⃣ Testing Claude Executor...');
  const healthResponse = await fetch(`${CLAUDE_URL}/health`);
  
  if (!healthResponse.ok) {
    console.error('❌ Claude Executor is not healthy');
    return;
  }
  
  const health = await healthResponse.json();
  console.log('✅ Claude Executor is healthy');
  console.log(`   Uptime: ${Math.round(health.uptime / 60)} minutes`);
  console.log(`   Sessions: ${health.sessions}\n`);
  
  // Test 2: Create a Draft (Sacred Flow Step 1)
  console.log('2️⃣ Creating Project.md Draft...');
  const draftResponse = await fetch(`${API_BASE}/api/draft-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      content: `## Task: Create CLI Tool for Code Analysis

## Acceptance Criteria:
- [ ] Parse JavaScript/TypeScript files
- [ ] Extract function signatures
- [ ] Generate documentation
- [ ] Output as Markdown

## Technical Details:
- Use AST parsing with @babel/parser
- Support ES6+ and TypeScript
- Include JSDoc comments
- Generate clean Markdown output`,
      metadata: {
        author: 'test-claude-integration',
        source: 'api'
      }
    })
  });
  
  if (!draftResponse.ok) {
    console.error('❌ Failed to create draft');
    return;
  }
  
  const { draft } = await draftResponse.json();
  console.log(`✅ Created draft: ${draft.id}`);
  console.log(`   State: ${draft.state}\n`);
  
  // Test 3: Task Creation with Claude
  console.log('3️⃣ Creating task in Claude Executor...');
  const taskMessage = `# TASK: Create CLI Tool for Code Analysis

## Checkpoints (3):

### Checkpoint 1: Set up project structure
- **Objective:** Create Node.js project with TypeScript
- **Test:** npm run build succeeds
- **Instructions:**
  1. Initialize package.json
  2. Install dependencies: @babel/parser, typescript, @types/node
  3. Create tsconfig.json
  4. Create src/index.ts entry point

### Checkpoint 2: Implement AST parser
- **Objective:** Parse JS/TS files and extract functions
- **Test:** Parse test file and find all functions
- **Instructions:**
  1. Create src/parser.ts
  2. Implement parseFile() function
  3. Extract function names, parameters, return types
  4. Handle both JS and TS syntax

### Checkpoint 3: Generate Markdown documentation
- **Objective:** Convert parsed data to Markdown
- **Test:** Generate valid Markdown output
- **Instructions:**
  1. Create src/generator.ts
  2. Format functions as Markdown
  3. Include JSDoc comments
  4. Write output to file`;
  
  const createTaskResponse = await fetch(`${API_BASE}/api/claude-executor-integration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-task',
      payload: [{
        message: {
          type: 'user',
          parts: [{ type: 'text', text: taskMessage }]
        }
      }]
    })
  });
  
  if (!createTaskResponse.ok) {
    console.error('❌ Failed to create task:', createTaskResponse.status);
    const error = await createTaskResponse.text();
    console.error(error);
    return;
  }
  
  const taskData = await createTaskResponse.json();
  console.log(`✅ Created Claude session: ${taskData.threadId}`);
  console.log(`   Checkpoints: ${taskData.checkpoints}`);
  console.log(`   URL: ${taskData.url}\n`);
  
  // Test 4: Monitor Execution
  console.log('4️⃣ Monitoring execution...');
  let completed = false;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  
  while (!completed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    
    const statusResponse = await fetch(`${API_BASE}/api/claude-executor-integration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check-status',
        payload: { threadId: taskData.threadId }
      })
    });
    
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log(`   Status: ${status.status} | Messages: ${status.messageCount} | Checkpoints: ${status.checkpointsCompleted}/${status.totalCheckpoints}`);
      
      completed = status.completed;
      
      if (status.lastResponse) {
        console.log(`   Claude: "${status.lastResponse.substring(0, 100)}..."`);
      }
    }
    
    attempts++;
  }
  
  if (completed) {
    console.log('✅ Task completed!\n');
  } else {
    console.log('⏱️ Task still running...\n');
  }
  
  // Test 5: Get Files
  console.log('5️⃣ Getting generated files...');
  const filesResponse = await fetch(`${API_BASE}/api/claude-executor-integration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get-files',
      payload: { threadId: taskData.threadId }
    })
  });
  
  if (filesResponse.ok) {
    const { files } = await filesResponse.json();
    console.log(`✅ Found ${files.length} files:`);
    files.forEach(file => {
      console.log(`   - ${file.path} (${file.type})`);
    });
  }
  
  // Test 6: Validate a Checkpoint
  console.log('\n6️⃣ Validating checkpoint...');
  const validateResponse = await fetch(`${API_BASE}/api/claude-executor-integration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'validate-checkpoint',
      payload: {
        threadId: taskData.threadId,
        checkpointId: 1,
        testCriteria: 'Run npm run build and verify it succeeds'
      }
    })
  });
  
  if (validateResponse.ok) {
    const validation = await validateResponse.json();
    console.log(`✅ Validation result: ${validation.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Output: "${validation.output.substring(0, 100)}..."`);
  }
  
  // Summary
  console.log('\n✨ Integration Test Complete!');
  console.log('\n📋 Sacred Flow Status:');
  console.log('   1. Draft ✅ Created');
  console.log('   2. Validation ⏭️ (Would run through validation-runner)');
  console.log('   3. Task ✅ Created in Claude');
  console.log('   4. Checkpoints ✅ Executing');
  console.log('   5. Review ⏭️ (Human approval needed)');
  console.log('   6. Merge ⏭️ (After approval)');
  
  console.log('\n🔗 Next Steps:');
  console.log('   1. Deploy execute-claude.js to use hybrid executor');
  console.log('   2. Update Task Orchestrator to route to Claude');
  console.log('   3. Set CLAUDE_EXECUTOR_URL in Vercel');
  console.log('   4. Gradually increase CLAUDE_ROLLOUT_PERCENTAGE');
}

test().catch(console.error);