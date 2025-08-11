// In-memory task storage (replace with database in production)
let tasks = [];

export default function handler(req, res) {
  switch (req.method) {
    case 'GET':
      // Return all tasks
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
      
      tasks.push(newTask);
      
      res.status(201).json(newTask);
      break;
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}