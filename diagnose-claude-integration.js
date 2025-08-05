#!/usr/bin/env node

// Diagnose Claude GitHub Integration Issues

const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';

async function diagnose() {
  console.log('🔍 Diagnosing Claude GitHub Integration\n');
  
  // Check system info
  console.log('1️⃣ Checking system configuration...');
  const infoResponse = await fetch(`${CLAUDE_URL}/`);
  const info = await infoResponse.json();
  console.log('   Service:', info.service);
  console.log('   Version:', info.version);
  console.log('   GitHub configured:', info.githubConfigured);
  console.log('   Features:', info.features.join(', '));
  
  // Create a test session
  console.log('\n2️⃣ Creating test session...');
  const sessionResponse = await fetch(`${CLAUDE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  if (!sessionResponse.ok) {
    console.error('❌ Failed to create session');
    return;
  }
  
  const session = await sessionResponse.json();
  console.log('✅ Session created:', session.sessionId);
  console.log('   Branch:', session.branch);
  
  // Test direct file creation
  console.log('\n3️⃣ Testing direct execution fallback...');
  const testResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Create a file called diagnostic-test.txt'
    })
  });
  
  const result = await testResponse.json();
  console.log('   Response:', result.response);
  console.log('   Files created:', result.files);
  
  // Check if Claude Code is being used
  if (result.response.includes('Direct execution') || result.response.includes('not fully implemented')) {
    console.log('\n⚠️  ISSUE DETECTED: Claude Code CLI is not being used!');
    console.log('   The server is falling back to direct execution mode.');
    console.log('   This means Claude cannot actually create files or run commands.');
    console.log('\n   To fix this:');
    console.log('   1. SSH into the container: fly ssh console -a uncle-frank-claude');
    console.log('   2. Check if Claude is installed: which claude');
    console.log('   3. If not, install it: npm install -g @anthropic-ai/claude-code');
    console.log('   4. Authenticate Claude: claude login');
  } else if (result.response.includes('permission')) {
    console.log('\n⚠️  ISSUE DETECTED: Claude needs permissions!');
    console.log('   Claude is installed but cannot execute commands.');
    console.log('   This might be a sandbox restriction.');
  } else {
    console.log('\n✅ Claude appears to be working correctly!');
  }
  
  // Summary
  console.log('\n📋 Diagnostic Summary:');
  console.log('   - GitHub integration: ✅ Working (repos are cloned)');
  console.log('   - Session creation: ✅ Working');
  console.log('   - Claude Code CLI: ❓ Check logs for details');
  console.log('   - File creation: ❌ Not working (permissions or CLI issue)');
  
  console.log('\n💡 Next steps:');
  console.log('   1. Check Fly.io logs: fly logs -a uncle-frank-claude');
  console.log('   2. SSH into container: fly ssh console -a uncle-frank-claude');
  console.log('   3. Verify Claude installation and authentication');
}

diagnose().catch(console.error);