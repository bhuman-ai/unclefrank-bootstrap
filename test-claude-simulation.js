#!/usr/bin/env node

// Test Claude Integration in Simulation Mode
// This version works even without API key

const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';
const API_BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'https://unclefrank-bootstrap.vercel.app';

async function test() {
  console.log('🔨 Testing Uncle Frank Claude Integration (Simulation Mode)\n');
  
  // Test 1: Claude Health Check
  console.log('1️⃣ Testing Claude Executor...');
  const healthResponse = await fetch(`${CLAUDE_URL}/health`);
  
  if (!healthResponse.ok) {
    console.error('❌ Claude Executor is not healthy');
    return;
  }
  
  const health = await healthResponse.json();
  console.log('✅ Claude Executor is healthy');
  console.log(`   Status: ${health.status}`);
  console.log(`   Sessions: ${health.sessions}`);
  console.log(`   API Key: ${health.anthropicConfigured ? 'Configured' : 'NOT CONFIGURED (Simulation Mode)'}\n`);
  
  // Test 2: Create Session Directly
  console.log('2️⃣ Creating Claude session directly...');
  const sessionResponse = await fetch(`${CLAUDE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: 'You are Uncle Frank, testing the system.'
    })
  });
  
  if (!sessionResponse.ok) {
    console.error('❌ Failed to create session');
    return;
  }
  
  const { sessionId } = await sessionResponse.json();
  console.log(`✅ Created session: ${sessionId}\n`);
  
  // Test 3: Execute Command
  console.log('3️⃣ Sending test command...');
  const executeResponse = await fetch(`${CLAUDE_URL}/api/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Create a simple hello.js file that prints "Hello from Uncle Frank"'
    })
  });
  
  if (!executeResponse.ok) {
    console.error('❌ Failed to execute command');
    return;
  }
  
  const executeResult = await executeResponse.json();
  console.log('✅ Command executed');
  console.log(`   Status: ${executeResult.status}`);
  console.log(`   Response: "${executeResult.response.substring(0, 100)}..."\n`);
  
  // Test 4: Integration Endpoint
  console.log('4️⃣ Testing integration endpoint...');
  const integrationResponse = await fetch(`${API_BASE}/api/claude-executor-integration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-task',
      payload: [{
        message: {
          type: 'user',
          parts: [{ 
            type: 'text', 
            text: '# Simple Test Task\n\n## Checkpoint 1: Create test file\n- Objective: Create hello.js\n- Test: File exists\n- Instructions: Create a file that prints hello'
          }]
        }
      }]
    })
  });
  
  console.log(`   Response status: ${integrationResponse.status}`);
  
  if (integrationResponse.ok) {
    const result = await integrationResponse.json();
    console.log('✅ Integration endpoint working');
    console.log(`   Thread ID: ${result.threadId}`);
    console.log(`   Executor: ${result.executor}`);
    console.log(`   Checkpoints: ${result.checkpoints}`);
  } else {
    const error = await integrationResponse.text();
    console.error('❌ Integration failed:', error);
  }
  
  // Summary
  console.log('\n📋 Test Summary:');
  console.log('   - Claude Executor: ✅ Running');
  console.log('   - API Key: ⚠️  Not configured (simulation mode)');
  console.log('   - Sessions: ✅ Working');
  console.log('   - Integration: ' + (integrationResponse.ok ? '✅ Connected' : '❌ Failed'));
  
  console.log('\n⚠️  IMPORTANT: Claude is running in simulation mode!');
  console.log('   To enable real execution:');
  console.log('   1. Install Fly CLI: curl -L https://fly.io/install.sh | sh');
  console.log('   2. Login: fly auth login');
  console.log('   3. Set API key: fly secrets set ANTHROPIC_API_KEY="your-key" -a uncle-frank-claude');
  console.log('\n   See SET_CLAUDE_API_KEY.md for detailed instructions.');
}

test().catch(console.error);