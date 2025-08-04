// FRANK'S DOCUMENT MANAGER - CORE STATE TRACKING AND DRAFT STORAGE

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// MongoDB connection configuration
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/unclefrank-docs';
const DB_NAME = 'unclefrank-docs';
const DRAFTS_COLLECTION = 'drafts';
const TASKS_COLLECTION = 'tasks';
const CHECKPOINTS_COLLECTION = 'checkpoints';

// In-memory fallback for development/testing
const STORAGE_FILE = path.join('/tmp', 'document-manager.json');

class DocumentManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.connected = false;
  }

  // Connect to MongoDB with retry logic
  async connect() {
    if (this.connected) return true;
    
    try {
      this.client = new MongoClient(MONGO_URI);
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.connected = true;
      console.log('✓ MongoDB connected');
      return true;
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
      // Fall back to file storage
      return false;
    }
  }

  // State interface for document tracking
  getStateInterface() {
    return {
      drafts: {
        create: this.createDraft.bind(this),
        read: this.readDraft.bind(this),
        update: this.updateDraft.bind(this),
        delete: this.deleteDraft.bind(this),
        list: this.listDrafts.bind(this)
      },
      tasks: {
        create: this.createTask.bind(this),
        read: this.readTask.bind(this),
        update: this.updateTask.bind(this),
        delete: this.deleteTask.bind(this),
        list: this.listTasks.bind(this)
      },
      checkpoints: {
        create: this.createCheckpoint.bind(this),
        read: this.readCheckpoint.bind(this),
        update: this.updateCheckpoint.bind(this),
        delete: this.deleteCheckpoint.bind(this),
        list: this.listCheckpoints.bind(this)
      }
    };
  }

  // CRUD Operations for Drafts
  async createDraft(draft) {
    const draftDoc = {
      id: draft.id || `draft-${Date.now()}`,
      content: draft.content,
      status: draft.status || 'pending',
      type: draft.type || 'project',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: draft.metadata || {}
    };

    if (this.connected) {
      try {
        const result = await this.db.collection(DRAFTS_COLLECTION).insertOne(draftDoc);
        return { ...draftDoc, _id: result.insertedId };
      } catch (error) {
        console.error('Draft creation failed:', error);
        return this.createDraftFile(draftDoc);
      }
    }
    
    return this.createDraftFile(draftDoc);
  }

  async readDraft(id) {
    if (this.connected) {
      try {
        return await this.db.collection(DRAFTS_COLLECTION).findOne({ id });
      } catch (error) {
        console.error('Draft read failed:', error);
      }
    }
    
    return this.readDraftFile(id);
  }

  async updateDraft(id, updates) {
    const updateDoc = {
      ...updates,
      updatedAt: new Date()
    };

    if (this.connected) {
      try {
        const result = await this.db.collection(DRAFTS_COLLECTION).updateOne(
          { id },
          { $set: updateDoc }
        );
        return result.matchedCount > 0;
      } catch (error) {
        console.error('Draft update failed:', error);
      }    }
    
    return this.updateDraftFile(id, updateDoc);
  }

  async deleteDraft(id) {
    if (this.connected) {
      try {
        const result = await this.db.collection(DRAFTS_COLLECTION).deleteOne({ id });
        return result.deletedCount > 0;
      } catch (error) {
        console.error('Draft deletion failed:', error);
      }
    }
    
    return this.deleteDraftFile(id);
  }

  async listDrafts(filters = {}) {
    if (this.connected) {
      try {
        return await this.db.collection(DRAFTS_COLLECTION).find(filters).toArray();
      } catch (error) {
        console.error('Draft listing failed:', error);
      }
    }
    
    return this.listDraftsFile(filters);
  }

  // CRUD Operations for Tasks
  async createTask(task) {
    const taskDoc = {
      id: task.id || `task-${Date.now()}`,
      name: task.name,
      objective: task.objective,
      status: task.status || 'pending',
      acceptanceCriteria: task.acceptanceCriteria || [],
      checkpoints: task.checkpoints || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: task.metadata || {}
    };

    if (this.connected) {
      try {
        const result = await this.db.collection(TASKS_COLLECTION).insertOne(taskDoc);
        return { ...taskDoc, _id: result.insertedId };
      } catch (error) {
        console.error('Task creation failed:', error);
      }
    }
    
    return this.createTaskFile(taskDoc);
  }

  async readTask(id) {
    if (this.connected) {
      try {
        return await this.db.collection(TASKS_COLLECTION).findOne({ id });
      } catch (error) {
        console.error('Task read failed:', error);
      }
    }
    
    return this.readTaskFile(id);
  }

  async updateTask(id, updates) {
    const updateDoc = {
      ...updates,
      updatedAt: new Date()
    };

    if (this.connected) {
      try {
        const result = await this.db.collection(TASKS_COLLECTION).updateOne(
          { id },
          { $set: updateDoc }
        );
        return result.matchedCount > 0;
      } catch (error) {
        console.error('Task update failed:', error);
      }
    }
    
    return this.updateTaskFile(id, updateDoc);
  }

  async deleteTask(id) {
    if (this.connected) {
      try {
        const result = await this.db.collection(TASKS_COLLECTION).deleteOne({ id });
        return result.deletedCount > 0;
      } catch (error) {
        console.error('Task deletion failed:', error);
      }
    }
    
    return this.deleteTaskFile(id);
  }

  async listTasks(filters = {}) {
    if (this.connected) {
      try {
        return await this.db.collection(TASKS_COLLECTION).find(filters).toArray();
      } catch (error) {
        console.error('Task listing failed:', error);
      }
    }
    
    return this.listTasksFile(filters);
  }

  // CRUD Operations for Checkpoints
  async createCheckpoint(checkpoint) {
    const checkpointDoc = {
      id: checkpoint.id || `checkpoint-${Date.now()}`,
      name: checkpoint.name,
      objective: checkpoint.objective,
      taskId: checkpoint.taskId,
      status: checkpoint.status || 'pending',
      blocking: checkpoint.blocking || false,
      parallelizable: checkpoint.parallelizable || false,
      instructions: checkpoint.instructions || [],
      passCriteria: checkpoint.passCriteria || [],
      retryCount: checkpoint.retryCount || 0,
      maxRetries: checkpoint.maxRetries || 3,
      logs: checkpoint.logs || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: checkpoint.metadata || {}
    };

    if (this.connected) {
      try {
        const result = await this.db.collection(CHECKPOINTS_COLLECTION).insertOne(checkpointDoc);
        return { ...checkpointDoc, _id: result.insertedId };
      } catch (error) {
        console.error('Checkpoint creation failed:', error);
      }
    }
    
    return this.createCheckpointFile(checkpointDoc);
  }

  async readCheckpoint(id) {
    if (this.connected) {
      try {
        return await this.db.collection(CHECKPOINTS_COLLECTION).findOne({ id });
      } catch (error) {
        console.error('Checkpoint read failed:', error);
      }
    }
    
    return this.readCheckpointFile(id);
  }

  async updateCheckpoint(id, updates) {
    const updateDoc = {
      ...updates,
      updatedAt: new Date()
    };

    if (this.connected) {
      try {
        const result = await this.db.collection(CHECKPOINTS_COLLECTION).updateOne(
          { id },
          { $set: updateDoc }
        );
        return result.matchedCount > 0;
      } catch (error) {
        console.error('Checkpoint update failed:', error);
      }
    }
    
    return this.updateCheckpointFile(id, updateDoc);
  }

  async deleteCheckpoint(id) {
    if (this.connected) {
      try {
        const result = await this.db.collection(CHECKPOINTS_COLLECTION).deleteOne({ id });
        return result.deletedCount > 0;
      } catch (error) {
        console.error('Checkpoint deletion failed:', error);
      }
    }
    
    return this.deleteCheckpointFile(id);
  }

  async listCheckpoints(filters = {}) {
    if (this.connected) {
      try {
        return await this.db.collection(CHECKPOINTS_COLLECTION).find(filters).toArray();
      } catch (error) {
        console.error('Checkpoint listing failed:', error);
      }
    }
    
    return this.listCheckpointsFile(filters);
  }

  // File-based fallback operations
  loadFileStorage() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = fs.readFileSync(STORAGE_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load file storage:', error);
    }
    return { drafts: {}, tasks: {}, checkpoints: {} };
  }

  saveFileStorage(data) {
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save file storage:', error);
    }
  }

  createDraftFile(draft) {
    const storage = this.loadFileStorage();
    storage.drafts[draft.id] = draft;
    this.saveFileStorage(storage);
    return draft;
  }

  readDraftFile(id) {
    const storage = this.loadFileStorage();
    return storage.drafts[id] || null;
  }

  updateDraftFile(id, updates) {
    const storage = this.loadFileStorage();
    if (storage.drafts[id]) {
      storage.drafts[id] = { ...storage.drafts[id], ...updates };
      this.saveFileStorage(storage);
      return true;
    }
    return false;
  }

  deleteDraftFile(id) {
    const storage = this.loadFileStorage();
    if (storage.drafts[id]) {
      delete storage.drafts[id];
      this.saveFileStorage(storage);
      return true;
    }
    return false;
  }

  listDraftsFile(filters) {
    const storage = this.loadFileStorage();
    let drafts = Object.values(storage.drafts);
    
    // Apply simple filters
    if (filters.status) {
      drafts = drafts.filter(draft => draft.status === filters.status);
    }
    if (filters.type) {
      drafts = drafts.filter(draft => draft.type === filters.type);
    }
    
    return drafts;
  }

  createTaskFile(task) {
    const storage = this.loadFileStorage();
    storage.tasks[task.id] = task;
    this.saveFileStorage(storage);
    return task;
  }

  readTaskFile(id) {
    const storage = this.loadFileStorage();
    return storage.tasks[id] || null;
  }

  updateTaskFile(id, updates) {
    const storage = this.loadFileStorage();
    if (storage.tasks[id]) {
      storage.tasks[id] = { ...storage.tasks[id], ...updates };
      this.saveFileStorage(storage);
      return true;
    }
    return false;
  }

  deleteTaskFile(id) {
    const storage = this.loadFileStorage();
    if (storage.tasks[id]) {
      delete storage.tasks[id];
      this.saveFileStorage(storage);
      return true;
    }
    return false;
  }

  listTasksFile(filters) {
    const storage = this.loadFileStorage();
    let tasks = Object.values(storage.tasks);
    
    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status);
    }
    
    return tasks;
  }

  createCheckpointFile(checkpoint) {
    const storage = this.loadFileStorage();
    storage.checkpoints[checkpoint.id] = checkpoint;
    this.saveFileStorage(storage);
    return checkpoint;
  }

  readCheckpointFile(id) {
    const storage = this.loadFileStorage();
    return storage.checkpoints[id] || null;
  }

  updateCheckpointFile(id, updates) {
    const storage = this.loadFileStorage();
    if (storage.checkpoints[id]) {
      storage.checkpoints[id] = { ...storage.checkpoints[id], ...updates };
      this.saveFileStorage(storage);
      return true;
    }
    return false;
  }

  deleteCheckpointFile(id) {
    const storage = this.loadFileStorage();
    if (storage.checkpoints[id]) {
      delete storage.checkpoints[id];
      this.saveFileStorage(storage);
      return true;
    }
    return false;
  }

  listCheckpointsFile(filters) {
    const storage = this.loadFileStorage();
    let checkpoints = Object.values(storage.checkpoints);
    
    if (filters.status) {
      checkpoints = checkpoints.filter(cp => cp.status === filters.status);
    }
    if (filters.taskId) {
      checkpoints = checkpoints.filter(cp => cp.taskId === filters.taskId);
    }
    
    return checkpoints;
  }

  // Test MongoDB connection
  async testConnection() {
    try {
      if (!this.connected) {
        await this.connect();
      }
      
      if (this.connected) {
        // Test basic operations
        await this.db.admin().ping();
        console.log('✓ MongoDB connection test passed');
        return { success: true, message: 'MongoDB connection active' };
      } else {
        console.log('⚠ Using file-based storage fallback');
        return { success: true, message: 'File-based storage active', fallback: true };
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Cleanup connection
  async close() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
    }
  }
}

// Global document manager instance
const documentManager = new DocumentManager();

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Initialize connection
    await documentManager.connect();

    const { action, collection, id, data, filters } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    // Get state interface
    const state = documentManager.getStateInterface();

    try {
      switch (action) {
        case 'test-connection':
          const testResult = await documentManager.testConnection();
          return res.status(200).json(testResult);

        case 'create':
          if (!collection || !data) {
            return res.status(400).json({ error: 'Collection and data required' });
          }
          const created = await state[collection].create(data);
          return res.status(201).json(created);

        case 'read':
          if (!collection || !id) {
            return res.status(400).json({ error: 'Collection and ID required' });
          }
          const item = await state[collection].read(id);
          if (!item) {
            return res.status(404).json({ error: 'Item not found' });
          }
          return res.status(200).json(item);

        case 'update':
          if (!collection || !id || !data) {
            return res.status(400).json({ error: 'Collection, ID, and data required' });
          }
          const updated = await state[collection].update(id, data);
          if (!updated) {
            return res.status(404).json({ error: 'Item not found' });
          }
          return res.status(200).json({ id, updated: true });

        case 'delete':
          if (!collection || !id) {
            return res.status(400).json({ error: 'Collection and ID required' });
          }
          const deleted = await state[collection].delete(id);
          if (!deleted) {
            return res.status(404).json({ error: 'Item not found' });
          }
          return res.status(200).json({ id, deleted: true });

        case 'list':
          if (!collection) {
            return res.status(400).json({ error: 'Collection required' });
          }
          const items = await state[collection].list(filters || {});
          return res.status(200).json({ items, count: items.length });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Document Manager Error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  } catch (serverError) {
    console.error('Document manager critical error:', serverError);
    return res.status(500).json({ 
      error: 'Document manager unavailable'
    });
  }
}