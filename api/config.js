// Simple config endpoint to prevent blank page errors

export default function handler(req, res) {
  res.status(200).json({
    orchestratorEnabled: false,
    claudeExecutorEnabled: true,
    version: '3.0.0'
  });
}