#!/usr/bin/env node

// Test Vercel deployment health

const VERCEL_URL = 'https://unclefrank-bootstrap.vercel.app';

async function testHealth() {
  console.log('🧪 Testing Vercel deployment health...\n');
  
  // Test root endpoint
  try {
    console.log('1️⃣ Testing root endpoint...');
    const rootResponse = await fetch(VERCEL_URL);
    console.log(`   Status: ${rootResponse.status}`);
    console.log(`   Content-Type: ${rootResponse.headers.get('content-type')}`);
    
    if (rootResponse.ok && rootResponse.headers.get('content-type')?.includes('text/html')) {
      console.log('   ✅ Root endpoint serving HTML');
    } else {
      console.log('   ❌ Root endpoint not working properly');
    }
  } catch (error) {
    console.error('   ❌ Failed to reach root:', error.message);
  }
  
  // Test execute API
  try {
    console.log('\n2️⃣ Testing /api/execute endpoint...');
    const apiResponse = await fetch(`${VERCEL_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'ping' })
    });
    
    console.log(`   Status: ${apiResponse.status}`);
    const data = await apiResponse.text();
    console.log(`   Response: ${data.substring(0, 100)}...`);
    
    if (apiResponse.status === 500 && data.includes('taskMessage.split')) {
      console.log('   ⚠️  Old code still deployed (taskMessage.split error)');
    } else if (apiResponse.ok || apiResponse.status === 400) {
      console.log('   ✅ API endpoint responding');
    } else {
      console.log('   ❌ API endpoint error');
    }
  } catch (error) {
    console.error('   ❌ Failed to reach API:', error.message);
  }
  
  // Test orchestrator
  try {
    console.log('\n3️⃣ Testing /api/task-orchestrator endpoint...');
    const orchResponse = await fetch(`${VERCEL_URL}/api/task-orchestrator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' })
    });
    
    console.log(`   Status: ${orchResponse.status}`);
    if (orchResponse.status === 500) {
      console.log('   ❌ Orchestrator failing (likely TERRAGON_AUTH error)');
    } else if (orchResponse.ok) {
      console.log('   ✅ Orchestrator responding');
    }
  } catch (error) {
    console.error('   ❌ Failed to reach orchestrator:', error.message);
  }
  
  console.log('\n📊 Summary:');
  console.log('Check https://vercel.com/bhuman/unclefrank-bootstrap for deployment status');
  console.log('Latest commit should be: 4f4b160');
}

testHealth();