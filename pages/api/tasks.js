const db = require('../../lib/database');

export default function handler(req, res) {
  switch (req.method) {
    case 'GET':
      // Return all tasks
      const tasks = db.getTasks();
      res.status(200).json({ 
        tasks: tasks,
        count: tasks.length 
      });
      break;
      
    case 'POST':
      // Create new task
      const newTask = {
        id: `task-${Date.now()}`,
        title: req.body.title || 'Untitled Task',
        description: req.body.description || '',
        status: 'pending',
        source: req.body.source || 'manual',
        priority: req.body.priority || 3,
        metadata: req.body.metadata || {},
        checkpoints: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      
      const created = db.createTask(newTask);
      res.status(201).json(created);
      break;
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}