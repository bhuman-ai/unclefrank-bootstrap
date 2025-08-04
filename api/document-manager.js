// Document Manager API - Core state management and MongoDB connection
// Following Uncle Frank's no-nonsense approach: simple, direct, gets the job done.

import { MongoClient } from 'mongodb';

// State interface for draft tracking
class DraftState {
  constructor() {
    this.drafts = new Map(); // In-memory cache for fast access
    this.mongoClient = null;
    this.db = null;
    this.isConnected = false;
  }

  // Initialize MongoDB connection
  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.MONGODB_DB_NAME || 'unclefrank_docs';
      
      this.mongoClient = new MongoClient(mongoUri);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(dbName);
      
      // Test the connection
      await this.db.admin().ping();
      this.isConnected = true;
      
      console.log('✓ MongoDB connection established');
      return true;
    } catch (error) {
      console.error('✗ MongoDB connection failed:', error.message);
      this.isConnected = false;
      throw new DocumentManagerError('Failed to connect to MongoDB', 'CONNECTION_ERROR', error);
    }
  }

  // Disconnect from MongoDB
  async disconnect() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.isConnected = false;
      console.log('✓ MongoDB connection closed');
    }
  }

  // Test MongoDB connection
  async testConnection() {
    if (!this.isConnected || !this.db) {
      throw new DocumentManagerError('Not connected to MongoDB', 'NOT_CONNECTED');
    }
    
    try {
      await this.db.admin().ping();
      return { status: 'connected', timestamp: new Date().toISOString() };
    } catch (error) {
      throw new DocumentManagerError('Connection test failed', 'CONNECTION_TEST_FAILED', error);
    }
  }

  // Save draft to both memory and MongoDB
  async saveDraft(draftId, content, metadata = {}) {
    try {
      const draft = {
        id: draftId,
        content,
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString(),
          createdAt: metadata.createdAt || new Date().toISOString()
        }
      };

      // Save to memory cache
      this.drafts.set(draftId, draft);

      // Save to MongoDB if connected
      if (this.isConnected && this.db) {
        const collection = this.db.collection('drafts');
        await collection.replaceOne(
          { id: draftId },
          draft,
          { upsert: true }
        );
      }

      return draft;
    } catch (error) {
      throw new DocumentManagerError(`Failed to save draft ${draftId}`, 'SAVE_FAILED', error);
    }
  }

  // Get draft from memory or MongoDB
  async getDraft(draftId) {
    try {
      // Try memory cache first
      if (this.drafts.has(draftId)) {
        return this.drafts.get(draftId);
      }

      // Fallback to MongoDB
      if (this.isConnected && this.db) {
        const collection = this.db.collection('drafts');
        const draft = await collection.findOne({ id: draftId });
        
        if (draft) {
          // Cache it for next time
          this.drafts.set(draftId, draft);
          return draft;
        }
      }

      return null;
    } catch (error) {
      throw new DocumentManagerError(`Failed to get draft ${draftId}`, 'GET_FAILED', error);
    }
  }

  // List all drafts
  async listDrafts() {
    try {
      const results = [];

      // Get from MongoDB if connected
      if (this.isConnected && this.db) {
        const collection = this.db.collection('drafts');
        const cursor = collection.find({}).sort({ 'metadata.updatedAt': -1 });
        const docs = await cursor.toArray();
        results.push(...docs);
      } else {
        // Fallback to memory cache
        results.push(...Array.from(this.drafts.values()));
      }

      return results;
    } catch (error) {
      throw new DocumentManagerError('Failed to list drafts', 'LIST_FAILED', error);
    }
  }

  // Delete draft
  async deleteDraft(draftId) {
    try {
      // Remove from memory
      this.drafts.delete(draftId);

      // Remove from MongoDB if connected
      if (this.isConnected && this.db) {
        const collection = this.db.collection('drafts');
        await collection.deleteOne({ id: draftId });
      }

      return true;
    } catch (error) {
      throw new DocumentManagerError(`Failed to delete draft ${draftId}`, 'DELETE_FAILED', error);
    }
  }
}

// Custom error class for better error handling
class DocumentManagerError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'DocumentManagerError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      originalError: this.originalError?.message
    };
  }
}

// Global state instance
const draftState = new DraftState();

// API Methods - exported for use
export const DocumentManager = {
  // Connection management
  connect: () => draftState.connect(),
  disconnect: () => draftState.disconnect(),
  testConnection: () => draftState.testConnection(),
  
  // Draft management
  saveDraft: (draftId, content, metadata) => draftState.saveDraft(draftId, content, metadata),
  getDraft: (draftId) => draftState.getDraft(draftId),
  listDrafts: () => draftState.listDrafts(),
  deleteDraft: (draftId) => draftState.deleteDraft(draftId),
  
  // State access
  getState: () => ({
    isConnected: draftState.isConnected,
    cacheSize: draftState.drafts.size,
    timestamp: new Date().toISOString()
  })
};

// Vercel API handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize connection if not connected
    if (!draftState.isConnected) {
      await DocumentManager.connect();
    }

    const { method } = req;
    const { action, draftId, content, metadata } = req.body || {};

    switch (method) {
      case 'GET':
        if (req.query.action === 'test') {
          const result = await DocumentManager.testConnection();
          return res.status(200).json(result);
        }
        
        if (req.query.action === 'state') {
          const state = DocumentManager.getState();
          return res.status(200).json(state);
        }
        
        if (req.query.action === 'list') {
          const drafts = await DocumentManager.listDrafts();
          return res.status(200).json({ drafts });
        }
        
        if (req.query.draftId) {
          const draft = await DocumentManager.getDraft(req.query.draftId);
          return res.status(200).json({ draft });
        }
        
        return res.status(400).json({ error: 'Invalid GET request' });

      case 'POST':
        switch (action) {
          case 'save':
            if (!draftId || !content) {
              return res.status(400).json({ error: 'draftId and content required' });
            }
            const savedDraft = await DocumentManager.saveDraft(draftId, content, metadata);
            return res.status(200).json({ draft: savedDraft });

          case 'get':
            if (!draftId) {
              return res.status(400).json({ error: 'draftId required' });
            }
            const draft = await DocumentManager.getDraft(draftId);
            return res.status(200).json({ draft });

          case 'delete':
            if (!draftId) {
              return res.status(400).json({ error: 'draftId required' });
            }
            await DocumentManager.deleteDraft(draftId);
            return res.status(200).json({ success: true });

          case 'test':
            const testResult = await DocumentManager.testConnection();
            return res.status(200).json(testResult);

          default:
            return res.status(400).json({ error: 'Invalid action' });
        }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Document Manager API Error:', error);
    
    if (error instanceof DocumentManagerError) {
      return res.status(500).json({ error: error.toJSON() });
    }
    
    return res.status(500).json({ 
      error: {
        name: 'InternalServerError',
        message: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
}