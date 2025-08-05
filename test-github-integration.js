#!/usr/bin/env node

// Test GitHub-Integrated Claude Executor

const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';
const API_BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'https://unclefrank-bootstrap.vercel.app';

async function test() {
  console.log('🔨 Testing GitHub-Integrated Claude Executor\n');
  
  // Test 1: Check Claude health
  console.log('1️⃣ Testing Claude Executor...');
  const healthResponse = await fetch(`${CLAUDE_URL}/health`);
  
  if (!healthResponse.ok) {
    console.error('❌ Claude Executor is not healthy');
    return;
  }
  
  const health = await healthResponse.json();
  console.log('✅ Claude Executor is healthy');
  console.log(`   GitHub configured: ${health.githubConfigured ? 'Yes' : 'No'}`);
  console.log(`   Sessions: ${health.sessions}\n`);
  
  // Test 2: Create a session (will clone repo)
  console.log('2️⃣ Creating GitHub session (cloning repo)...');
  const sessionResponse = await fetch(`${CLAUDE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: 'You are Uncle Frank. Create real files, no BS!'
    })
  });
  
  if (!sessionResponse.ok) {
    console.error('❌ Failed to create session');
    const error = await sessionResponse.text();
    console.error(error);
    return;
  }
  
  const session = await sessionResponse.json();
  console.log(`✅ Created session: ${session.sessionId}`);
  console.log(`   Branch: ${session.branch}`);
  console.log(`   Repo path: ${session.repoPath}`);
  console.log(`   GitHub URL: ${session.githubUrl}\n`);
  
  // Test 3: Execute a simple file creation task
  console.log('3️⃣ Creating a real file...');
  const executeResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Create a file called test-from-claude.js with this content:

// Created by Claude at ${new Date().toISOString()}
console.log("Hello from GitHub-integrated Claude!");
console.log("This file was created in a real git repository!");

Also run: git add test-from-claude.js
Then run: git status

Show me the output of git status.`
    })
  });
  
  if (!executeResponse.ok) {
    console.error('❌ Failed to execute task');
    return;
  }
  
  const result = await executeResponse.json();
  console.log('✅ Task executed');
  console.log(`   Status: ${result.status}`);
  console.log(`   Files: ${JSON.stringify(result.files)}`);
  console.log(`   Response preview: ${result.response.substring(0, 200)}...\n`);
  
  // Test 4: Check files
  console.log('4️⃣ Checking files in repository...');
  const filesResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}/files`);
  
  if (filesResponse.ok) {
    const filesData = await filesResponse.json();
    console.log(`✅ Repository contains ${filesData.total} files`);
    console.log(`   Modified files: ${JSON.stringify(filesData.modified)}\n`);
  }
  
  // Test 5: Commit changes
  console.log('5️⃣ Committing changes...');
  const commitResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Test commit from GitHub-integrated Claude'
    })
  });
  
  if (commitResponse.ok) {
    const commit = await commitResponse.json();
    console.log('✅ Changes committed');
    console.log(`   Branch: ${commit.branch}`);
    console.log(`   GitHub URL: ${commit.githubUrl}`);
    console.log(`   Message: ${commit.message}\n`);
  } else {
    console.log('❌ Commit failed (might need GitHub token)\n');
  }
  
  // Test 6: Integration with Uncle Frank
  console.log('6️⃣ Testing Uncle Frank integration...');
  const taskResponse = await fetch(`${API_BASE}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-task',
      payload: [{
        message: {
          parts: [{
            text: `# Simple Test Task

## Checkpoint 1: Create test file
- Objective: Create a hello-github.js file
- Test: File exists and contains valid JavaScript
- Instructions: Create a file that logs "Hello from GitHub integration"`
          }]
        }
      }]
    })
  });
  
  if (taskResponse.ok) {
    const task = await taskResponse.json();
    console.log('✅ Uncle Frank integration working');
    console.log(`   Thread ID: ${task.threadId}`);
    console.log(`   Branch: ${task.branch}`);
    console.log(`   GitHub URL: ${task.githubUrl}`);
  } else {
    console.log('❌ Uncle Frank integration failed');
  }
  
  // Summary
  console.log('\n✨ GitHub Integration Test Complete!\n');
  console.log('📋 What this means:');
  console.log('   - Claude can now create REAL files');
  console.log('   - Changes are tracked in git');
  console.log('   - Each session gets its own branch');
  console.log('   - You can create PRs from the changes');
  console.log('   - No more "I would create..." - actual creation!');
}

test().catch(console.error);