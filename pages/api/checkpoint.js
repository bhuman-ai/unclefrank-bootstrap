// Simple checkpoint API
let checkpoints = [];

export default function handler(req, res) {
  switch (req.method) {
    case 'GET':
      res.status(200).json({ checkpoints });
      break;
      
    case 'POST':
      const checkpoint = {
        id: `cp-${Date.now()}`,
        taskId: req.body.taskId,
        name: req.body.checkpoint?.name || 'Checkpoint',
        description: req.body.checkpoint?.description || '',
        passCriteria: req.body.checkpoint?.passCriteria || '',
        status: 'pending',
        created: new Date().toISOString()
      };
      
      checkpoints.push(checkpoint);
      res.status(201).json(checkpoint);
      break;
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}