// Document Manager API - Base Foundation
// Draft state tracking and MongoDB schema integration

const { MongoClient } = require('mongodb');

// Draft State Interface - JavaScript representation
const DraftStateSchema = {
  id: String,
  content: String,
  validated: Boolean,
  validationErrors: Array,
  version: Number,
  createdAt: Date,
  updatedAt: Date,
  status: String, // 'draft', 'validating', 'approved', 'rejected'
  metadata: {
    author: String,
    taskId: String,
    checkpointId: String,
    parentVersion: String
  }
};

// MongoDB Schema Definition for Draft Tracking
const mongoSchemas = {
  drafts: {
    bsonType: 'object',
    required: ['id', 'content', 'version', 'status', 'createdAt'],
    properties: {
      _id: { bsonType: 'objectId' },
      id: { bsonType: 'string' },
      content: { bsonType: 'string' },
      validated: { bsonType: 'bool' },
      validationErrors: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          properties: {
            type: { enum: ['ux', 'technical', 'logic'] },
            message: { bsonType: 'string' },
            line: { bsonType: 'int' },
            suggestion: { bsonType: 'string' }
          }
        }
      },
      version: { bsonType: 'int' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
      status: { enum: ['draft', 'validating', 'approved', 'rejected'] },
      metadata: {
        bsonType: 'object',
        properties: {
          author: { bsonType: 'string' },
          taskId: { bsonType: 'string' },
          checkpointId: { bsonType: 'string' },
          parentVersion: { bsonType: 'string' }
        }
      }
    }
  }
};

// Version Control Hooks
const versionControlHooks = {
  beforeCreate: async (draft) => {
    draft.version = 1;
    draft.createdAt = new Date();
    draft.updatedAt = new Date();
    return draft;
  },
  
  beforeUpdate: async (draft) => {
    draft.version += 1;
    draft.updatedAt = new Date();
    return draft;
  },
  
  afterValidation: async (draft, validationResult) => {
    draft.validated = validationResult.isValid;
    draft.validationErrors = validationResult.errors || [];
    return draft;
  }
};

// Document Manager Class
class DocumentManagerAPI {
  constructor(mongoUrl = process.env.MONGODB_URI) {
    this.mongoUrl = mongoUrl;
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (!this.client) {
      this.client = new MongoClient(this.mongoUrl);
      await this.client.connect();
      this.db = this.client.db('document_manager');
    }
  }

  async createDraft(draftData) {
    await this.connect();
    const draft = await versionControlHooks.beforeCreate({
      id: this.generateId(),
      validated: false,
      status: 'draft',
      validationErrors: [],
      ...draftData
    });
    
    const result = await this.db.collection('drafts').insertOne(draft);
    return { ...draft, _id: result.insertedId };
  }

  async updateDraft(id, updates) {
    await this.connect();
    const updatedDraft = await versionControlHooks.beforeUpdate(updates);
    
    const result = await this.db.collection('drafts').updateOne(
      { id },
      { $set: updatedDraft }
    );
    
    return result.modifiedCount > 0;
  }

  async getDraft(id) {
    await this.connect();
    return await this.db.collection('drafts').findOne({ id });
  }

  async listDrafts(filter = {}) {
    await this.connect();
    return await this.db.collection('drafts').find(filter).toArray();
  }

  generateId() {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}

// API Endpoint Exports
module.exports = {
  DocumentManagerAPI,
  DraftStateSchema,
  mongoSchemas,
  versionControlHooks
};

// Health check function for API endpoints
module.exports.healthCheck = async () => {
  try {
    const manager = new DocumentManagerAPI();
    await manager.connect();
    await manager.close();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};