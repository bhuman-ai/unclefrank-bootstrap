#!/usr/bin/env node

// Test with Vercel logs
const API_BASE = 'https://unclefrank-bootstrap-ld79j1hqc-bhuman.vercel.app';

async function test() {
  console.log('🧪 Creating task...\n');
  
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
              text: 'Create a todo list component'
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
  console.log(`🔗 https://www.terragonlabs.com/task/${threadId}\n`);
  
  // Register
  console.log('📝 Registering...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      instanceId: threadId,
      metadata: { type: 'main-task' }
    })
  });
  
  // Wait
  await new Promise(r => setTimeout(r, 3000));
  
  // Poll
  console.log('🔄 Polling...');
  await fetch(`${API_BASE}/api/task-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll' })
  });
  
  console.log('\n⚡ Check Vercel logs for orchestrator output');
  console.log('🔗 https://vercel.com/bhuman/unclefrank-bootstrap/5fNkRgFNpK63vnXNMcTeafk7jnwR/functions\n');
}

test().catch(console.error);