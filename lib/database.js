// Simple file-based database for persistence
// In production, use a real database
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), '.data', 'tasks.json');

class Database {
  constructor() {
    this.tasks = [];
    this.checkpoints = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        this.tasks = data.tasks || [];
        this.checkpoints = data.checkpoints || [];
      }
    } catch (error) {
      console.error('Failed to load database:', error);
    }
  }

  save() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify({
        tasks: this.tasks,
        checkpoints: this.checkpoints
      }, null, 2));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  // Tasks
  getTasks() {
    return this.tasks;
  }

  createTask(task) {
    this.tasks.push(task);
    this.save();
    return task;
  }

  updateTask(id, updates) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      this.save();
      return this.tasks[index];
    }
    return null;
  }

  // Checkpoints
  getCheckpoints() {
    return this.checkpoints;
  }

  createCheckpoint(checkpoint) {
    this.checkpoints.push(checkpoint);
    this.save();
    return checkpoint;
  }
}

// Singleton instance
let db;
if (!db) {
  db = new Database();
}

module.exports = db;