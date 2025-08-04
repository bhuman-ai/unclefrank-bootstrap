// Document Manager API - Core state tracking and CRUD operations
// This handles draft storage, state management, and document lifecycle

// State Interface Definition
const DocumentState = {
  DRAFT: 'draft',
  VALIDATION_PENDING: 'validation_pending', 
  VALIDATION_FAILED: 'validation_failed',
  TASK_BREAKDOWN: 'task_breakdown',
  CHECKPOINT_EXECUTION: 'checkpoint_execution',
  REVIEW_PENDING: 'review_pending',
  APPROVED: 'approved',
  PRODUCTION: 'production'
};

const DocumentSchema = {
  id: String,
  type: String, // 'project', 'interface', 'technical', 'task', 'checkpoint'
  title: String,
  content: String,
  state: String, // One of DocumentState values
  version: Number,
  parentId: String, // For drafts/versions
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    createdBy: String,
    lastModifiedBy: String,
    tags: [String],
    priority: String,
    dependencies: [String]
  },
  validationResults: {
    isValid: Boolean,
    violations: [String],
    warnings: [String],
    lastValidated: Date
  },
  approvalInfo: {
    isApproved: Boolean,
    approvedBy: String,
    approvedAt: Date,
    rejectionReason: String
  }
};

// MongoDB connection setup
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  // For this checkpoint, we'll use a simple in-memory store
  // In production, this would connect to actual MongoDB
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not set, using in-memory storage for development');
    // Simple in-memory store for development/testing
    const inMemoryStore = {
      documents: new Map(),
      
      async insertOne(doc) {
        const id = doc.id || `doc-${Date.now()}-${Math.random()}`;
        doc.id = id;
        doc.createdAt = new Date();
        doc.updatedAt = new Date();
        this.documents.set(id, { ...doc });
        return { insertedId: id };
      },
      
      async findOne(query) {
        if (query.id) {
          return this.documents.get(query.id) || null;
        }
        for (const doc of this.documents.values()) {
          if (Object.keys(query).every(key => doc[key] === query[key])) {
            return doc;
          }
        }
        return null;
      },
      
      async find(query = {}) {
        const results = [];
        for (const doc of this.documents.values()) {
          if (Object.keys(query).every(key => doc[key] === query[key])) {
            results.push(doc);
          }
        }
        return { toArray: async () => results };
      },
      
      async updateOne(query, update) {
        const doc = await this.findOne(query);
        if (doc) {
          Object.assign(doc, update.$set || update);
          doc.updatedAt = new Date();
          this.documents.set(doc.id, doc);
          return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
      },
      
      async deleteOne(query) {
        const doc = await this.findOne(query);
        if (doc) {
          this.documents.delete(doc.id);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      }
    };
    
    cachedDb = { collection: () => inMemoryStore };
    return cachedDb;
  }

  // In production, this would be:
  // const { MongoClient } = require('mongodb');
  // const client = new MongoClient(MONGODB_URI);
  // await client.connect();
  // cachedDb = client.db('document_manager');
  
  throw new Error('MongoDB connection not implemented for production yet');
}

// Basic CRUD Operations
class DocumentManager {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await connectToDatabase();
    return this;
  }

  async createDocument(documentData) {
    const collection = this.db.collection('documents');
    
    const document = {
      ...documentData,
      id: documentData.id || `doc-${Date.now()}-${Math.random()}`,
      state: documentData.state || DocumentState.DRAFT,
      version: 1,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: documentData.createdBy || 'system',
        lastModifiedBy: documentData.createdBy || 'system',
        tags: documentData.tags || [],
        priority: documentData.priority || 'medium',
        dependencies: documentData.dependencies || []
      },
      validationResults: {
        isValid: false,
        violations: [],
        warnings: [],
        lastValidated: null
      },
      approvalInfo: {
        isApproved: false,
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null
      }
    };

    const result = await collection.insertOne(document);
    return { ...document, _id: result.insertedId };
  }

  async getDocument(id) {
    const collection = this.db.collection('documents');
    return await collection.findOne({ id });
  }

  async updateDocument(id, updates) {
    const collection = this.db.collection('documents');
    
    const updateData = {
      ...updates,
      'metadata.updatedAt': new Date(),
      'metadata.lastModifiedBy': updates.lastModifiedBy || 'system'
    };

    const result = await collection.updateOne(
      { id },
      { $set: updateData }
    );

    return result.modifiedCount > 0;
  }

  async deleteDocument(id) {
    const collection = this.db.collection('documents');
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async listDocuments(filter = {}) {
    const collection = this.db.collection('documents');
    const cursor = await collection.find(filter);
    return await cursor.toArray();
  }

  async updateDocumentState(id, newState) {
    return await this.updateDocument(id, { 
      state: newState,
      'metadata.stateChangedAt': new Date()
    });
  }

  async getDraftsByParent(parentId) {
    return await this.listDocuments({ 
      parentId,
      state: DocumentState.DRAFT 
    });
  }

  // Test connection method
  async testConnection() {
    try {
      await this.init();
      // Test basic operations
      const testDoc = await this.createDocument({
        type: 'test',
        title: 'Connection Test Document',
        content: 'This is a test document to verify the connection works.',
        createdBy: 'system-test'
      });

      const retrieved = await this.getDocument(testDoc.id);
      const updated = await this.updateDocument(testDoc.id, { 
        title: 'Updated Test Document' 
      });
      const deleted = await this.deleteDocument(testDoc.id);

      return {
        success: true,
        tests: {
          create: !!testDoc,
          read: !!retrieved,
          update: updated,
          delete: deleted
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// API Handler
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
    const manager = await new DocumentManager().init();

    switch (req.method) {
      case 'GET': {
        const { id, filter } = req.query;
        
        if (id) {
          const document = await manager.getDocument(id);
          if (!document) {
            return res.status(404).json({ error: 'Document not found' });
          }
          return res.status(200).json({ document });
        }

        const documents = await manager.listDocuments(filter ? JSON.parse(filter) : {});
        return res.status(200).json({ documents });
      }

      case 'POST': {
        const { action, ...data } = req.body;

        if (action === 'test-connection') {
          const result = await manager.testConnection();
          return res.status(result.success ? 200 : 500).json(result);
        }

        const document = await manager.createDocument(data);
        return res.status(201).json({ document });
      }

      case 'PUT': {
        const { id } = req.query;
        const updates = req.body;

        if (!id) {
          return res.status(400).json({ error: 'Document ID required' });
        }

        const success = await manager.updateDocument(id, updates);
        if (!success) {
          return res.status(404).json({ error: 'Document not found' });
        }

        const updated = await manager.getDocument(id);
        return res.status(200).json({ document: updated });
      }

      case 'DELETE': {
        const { id } = req.query;

        if (!id) {
          return res.status(400).json({ error: 'Document ID required' });
        }

        const success = await manager.deleteDocument(id);
        if (!success) {
          return res.status(404).json({ error: 'Document not found' });
        }

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Document Manager API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export the DocumentState enum and DocumentManager class for use in other modules
export { DocumentState, DocumentManager, DocumentSchema };