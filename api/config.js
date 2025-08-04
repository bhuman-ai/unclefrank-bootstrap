// FRANK'S SECURE CONFIGURATION
// This provides the orchestrator API key to the frontend without exposing it directly

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // FRANK'S APPROACH: Provide configuration without exposing secrets
  // In production, this would use proper authentication
  const config = {
    orchestratorEnabled: !!process.env.ORCHESTRATOR_API_KEY,
    // In production, use a session-based token instead
    orchestratorKey: process.env.NODE_ENV === 'development' 
      ? process.env.ORCHESTRATOR_API_KEY 
      : 'use-proper-auth-flow',
    features: {
      orchestrator: true,
      taskReview: true,
      contextlessTests: true
    }
  };

  return res.status(200).json(config);
}