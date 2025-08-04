import { MongoClient } from 'mongodb';

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'terragon_dev';

let client;
let db;

// State interface for document tracking
class DocumentState {
  constructor() {
    this.drafts = new Map();
    this.tasks = new Map();
    this.checkpoints = new Map();
    this.status = 'initialized';
    this.lastUpdate = new Date().toISOString();
  }

  // Core state methods
  addDraft(draft) {
    this.drafts.set(draft.id, {
      ...draft,
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    this.lastUpdate = new Date().toISOString();
  }

  getDraft(id) {
    return this.drafts.get(id);
  }

  getAllDrafts() {
    return Array.from(this.drafts.values());
  }

  updateDraftStatus(id, status) {
    const draft = this.drafts.get(id);
    if (draft) {
      draft.status = status;
      draft.updatedAt = new Date().toISOString();
      this.lastUpdate = new Date().toISOString();
      return true;
    }
    return false;
  }

  getState() {
    return {
      status: this.status,
      lastUpdate: this.lastUpdate,
      draftsCount: this.drafts.size,
      tasksCount: this.tasks.size,
      checkpointsCount: this.checkpoints.size
    };
  }
}

// Global state instance
const documentState = new DocumentState();

// MongoDB connection functions
async function connectToMongoDB() {
  try {
    if (!client) {
      client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db(DATABASE_NAME);
      console.log('✓ MongoDB connected successfully');
    }
    return db;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

async function disconnectFromMongoDB() {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('✓ MongoDB disconnected');
    }
  } catch (error) {
    console.error('MongoDB disconnect error:', error.message);
  }
}

// Draft storage functions
async function saveDraft(draft) {
  try {
    const database = await connectToMongoDB();
    const collection = database.collection('drafts');
    
    const draftDocument = {
      ...draft,
      _id: draft.id,
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await collection.replaceOne(
      { _id: draft.id },
      draftDocument,
      { upsert: true }
    );

    // Update in-memory state
    documentState.addDraft(draft);
    
    return { success: true, id: draft.id };
  } catch (error) {
    console.error('Error saving draft:', error.message);
    throw new Error(`Failed to save draft: ${error.message}`);
  }
}

async function getDraft(id) {
  try {
    const database = await connectToMongoDB();
    const collection = database.collection('drafts');
    
    const draft = await collection.findOne({ _id: id });
    return draft;
  } catch (error) {
    console.error('Error getting draft:', error.message);
    throw new Error(`Failed to get draft: ${error.message}`);
  }
}

async function getAllDrafts() {
  try {
    const database = await connectToMongoDB();
    const collection = database.collection('drafts');
    
    const drafts = await collection.find({}).toArray();
    return drafts;
  } catch (error) {
    console.error('Error getting all drafts:', error.message);
    throw new Error(`Failed to get drafts: ${error.message}`);
  }
}

// Basic error handling middleware
function handleError(error, operation = 'operation') {
  const errorMessage = error.message || 'Unknown error occurred';
  console.error(`Error in ${operation}:`, errorMessage);
  
  return {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    operation
  };
}

// Health check function
async function healthCheck() {
  try {
    const database = await connectToMongoDB();
    await database.admin().ping();
    
    return {
      success: true,
      status: 'healthy',
      mongodb: 'connected',
      timestamp: new Date().toISOString(),
      state: documentState.getState()
    };
  } catch (error) {
    return handleError(error, 'healthCheck');
  }
}

// Export all functions
export {
  // State management
  DocumentState,
  documentState,
  
  // Database functions
  connectToMongoDB,
  disconnectFromMongoDB,
  
  // Draft operations
  saveDraft,
  getDraft,
  getAllDrafts,
  
  // Utilities
  handleError,
  healthCheck
};