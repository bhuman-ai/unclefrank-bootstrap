// FRANK'S TASK ORCHESTRATOR - DISABLED (Using Claude Executor Instead)
// This orchestrator was for Terragon - we now use Claude directly

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, threadId } = req.body;

  // For now, just acknowledge the request
  // The real orchestration happens in claude-executor-integration.js
  console.log(`[Orchestrator] Action: ${action}, Thread: ${threadId}`);
  
  return res.status(200).json({
    success: true,
    message: 'Task orchestration handled by Claude executor',
    action,
    threadId
  });
}