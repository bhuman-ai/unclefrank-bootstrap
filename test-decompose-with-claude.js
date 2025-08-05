#!/usr/bin/env node

// Test Decompose Task with Claude Integration

const VERCEL_URL = 'https://unclefrank-bootstrap-2mzo9z74e-bhuman.vercel.app';

async function testDecomposeTask() {
  console.log('🧪 Testing Decompose Task with Claude Integration\n');
  
  const taskPayload = {
    action: "create-task",
    payload: [{
      message: {
        type: "user",
        model: "sonnet",
        parts: [{
          type: "rich-text",
          nodes: [{
            type: "text",
            text: "Create a simple test file called hello-frank.js that prints 'Hello from Uncle Frank!'"
          }]
        }],
        timestamp: new Date().toISOString()
      },
      githubRepoFullName: "bhuman-ai/unclefrank-bootstrap",
      repoBaseBranchName: "master",
      saveAsDraft: false
    }]
  };

  try {
    console.log('📤 Sending task to Vercel endpoint...');
    const response = await fetch(`${VERCEL_URL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Origin': VERCEL_URL,
        'Referer': `${VERCEL_URL}/`
      },
      body: JSON.stringify(taskPayload)
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\n📄 Raw response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('\n✅ Parsed response:', JSON.stringify(data, null, 2));
      
      if (data.sessionId) {
        console.log('\n🎉 Success! Claude session created:', data.sessionId);
        console.log('📍 Branch:', data.branch);
        console.log('🔗 GitHub URL:', data.githubUrl);
      }
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Also test direct Claude executor
async function testDirectClaude() {
  console.log('\n\n🧪 Testing Direct Claude Executor\n');
  
  const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';
  
  try {
    // Test health endpoint
    console.log('🏥 Checking Claude health...');
    const healthResponse = await fetch(`${CLAUDE_URL}/health`);
    const health = await healthResponse.json();
    console.log('✅ Health:', health);
    
    // Create session
    console.log('\n📂 Creating Claude session...');
    const sessionResponse = await fetch(`${CLAUDE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!sessionResponse.ok) {
      console.error('❌ Session creation failed:', sessionResponse.status);
      const error = await sessionResponse.text();
      console.error('Error:', error);
      return;
    }
    
    const session = await sessionResponse.json();
    console.log('✅ Session created:', session);
    
  } catch (error) {
    console.error('❌ Direct Claude test failed:', error);
  }
}

// Run both tests
async function runTests() {
  await testDecomposeTask();
  await testDirectClaude();
}

runTests();