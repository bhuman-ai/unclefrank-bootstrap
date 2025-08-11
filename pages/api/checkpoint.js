const db = require('../../lib/database');

export default function handler(req, res) {
  switch (req.method) {
    case 'GET':
      const checkpoints = db.getCheckpoints();
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
      
      const created = db.createCheckpoint(checkpoint);
      res.status(201).json(created);
      break;
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}