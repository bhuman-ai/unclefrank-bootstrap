// Test to see what happens with the message extraction in the deployed environment

const VERCEL_URL = 'https://unclefrank-bootstrap-2mzo9z74e-bhuman.vercel.app';

// Try calling the claude-executor-integration endpoint directly
async function testDirect() {
  console.log('Testing claude-executor-integration directly...\n');
  
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

  try {
    const response = await fetch(`${VERCEL_URL}/api/claude-executor-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify(taskPayload)
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response:', responseText);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirect();
