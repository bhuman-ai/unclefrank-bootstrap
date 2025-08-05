// Debug the message parsing issue

const taskData = {
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
};

// Simulate the message extraction logic
let taskMessage = '';
console.log('taskData.message:', taskData.message);
console.log('typeof taskData.message:', typeof taskData.message);

if (typeof taskData.message === 'string') {
  console.log('Branch 1: message is string');
  taskMessage = taskData.message;
} else if (taskData.message?.parts?.[0]?.text) {
  console.log('Branch 2: message has parts[0].text');
  taskMessage = taskData.message.parts[0].text;
} else if (taskData.message?.parts?.[0]?.nodes) {
  console.log('Branch 3: message has parts[0].nodes');
  const nodes = taskData.message.parts[0].nodes;
  console.log('nodes:', nodes);
  taskMessage = nodes.map(node => node.text || '').join('');
} else {
  console.log('Branch 4: fallback to JSON.stringify');
  taskMessage = JSON.stringify(taskData.message);
}

console.log('Final taskMessage:', taskMessage);
console.log('typeof taskMessage:', typeof taskMessage);
console.log('taskMessage.split available:', typeof taskMessage.split);

// Test the extractCheckpoints function
function extractCheckpoints(taskMessage) {
  const checkpoints = [];
  const messageStr = typeof taskMessage === 'string' ? taskMessage : JSON.stringify(taskMessage);
  console.log('messageStr:', messageStr);
  const lines = messageStr.split('\n');
  console.log('lines:', lines);
  return checkpoints;
}

try {
  const checkpoints = extractCheckpoints(taskMessage);
  console.log('✅ extractCheckpoints worked');
} catch (error) {
  console.error('❌ extractCheckpoints failed:', error.message);
}
