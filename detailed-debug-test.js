#\!/usr/bin/env node

const VERCEL_URL = 'https://unclefrank-bootstrap-2mzo9z74e-bhuman.vercel.app';

async function debugTest() {
  console.log('🔬 Detailed Debug Test\n');
  
  // Test with exact payload from the failing test
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
            text: "Create a simple test file called hello-frank.js that prints 'Hello from Uncle Frank\!'"
          }]
        }],
        timestamp: new Date().toISOString()
      },
      githubRepoFullName: "bhuman-ai/unclefrank-bootstrap",
      repoBaseBranchName: "master",
      saveAsDraft: false
    }]
  };

  console.log('📦 Sending payload:');
  console.log(JSON.stringify(taskPayload, null, 2));
  
  try {
    const response = await fetch(`${VERCEL_URL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify(taskPayload)
    });

    console.log('\n📥 Response status:', response.status);
    const responseText = await response.text();
    console.log('📄 Raw response:', responseText);
    
    // Also test just the message extraction part separately
    console.log('\n🧪 Testing message extraction locally:');
    const taskData = taskPayload.payload[0];
    console.log('Message object:', taskData.message);
    
    let taskMessage = '';
    if (typeof taskData.message === 'string') {
      taskMessage = taskData.message;
      console.log('✅ Used string branch');
    } else if (taskData.message?.parts?.[0]?.text) {
      taskMessage = taskData.message.parts[0].text;
      console.log('✅ Used parts[0].text branch');
    } else if (taskData.message?.parts?.[0]?.nodes) {
      const nodes = taskData.message.parts[0].nodes;
      taskMessage = nodes.map(node => node.text || '').join('');
      console.log('✅ Used parts[0].nodes branch');
    } else {
      taskMessage = JSON.stringify(taskData.message);
      console.log('✅ Used JSON.stringify branch');
    }
    
    console.log('Final taskMessage:', taskMessage);
    console.log('taskMessage type:', typeof taskMessage);
    console.log('Has split method:', typeof taskMessage.split === 'function');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugTest();
