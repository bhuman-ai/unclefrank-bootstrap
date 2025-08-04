// Document Manager API - State Tracking & Draft Management
// Uncle Frank's no-BS approach to document state management

import { MongoClient } from 'mongodb';

// Draft state interface definition
const DraftStates = {
  DRAFT: 'draft',
  VALIDATION: 'validation',
  TASK_BREAKDOWN: 'task_breakdown',
  CHECKPOINT_EXECUTION: 'checkpoint_execution',
  REVIEW: 'review',
  APPROVED: 'approved',
  MERGED: 'merged',
  REJECTED: 'rejected'
};

class DocumentManagerAPI {
  constructor() {
    this.client = null;
    this.db = null;
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/unclefrank';
  }

  // MongoDB connection setup
  async connect() {
    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db('unclefrank');
      console.log('✓ MongoDB connection established');
      return true;
    } catch (error) {
      console.error('✗ MongoDB connection failed:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  // Test MongoDB connection
  async testConnection() {
    try {
      if (!this.client) {
        await this.connect();
      }
      await this.db.admin().ping();
      return { success: true, message: 'MongoDB connection test passed' };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error.message}` };
    }
  }

  // Draft state management
  async createDraft(content, metadata = {}) {
    try {
      const draft = {
        id: `draft_${Date.now()}`,
        content,
        state: DraftStates.DRAFT,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [{
          state: DraftStates.DRAFT,
          timestamp: new Date(),
          action: 'created'
        }]
      };

      const result = await this.db.collection('drafts').insertOne(draft);
      return { success: true, draft: { ...draft, _id: result.insertedId } };
    } catch (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }
  }

  // Update draft state
  async updateDraftState(draftId, newState, metadata = {}) {
    try {
      const updateData = {
        state: newState,
        updatedAt: new Date(),
        $push: {
          history: {
            state: newState,
            timestamp: new Date(),
            metadata
          }
        }
      };

      const result = await this.db.collection('drafts').updateOne(
        { id: draftId },
        updateData
      );

      if (result.matchedCount === 0) {
        throw new Error(`Draft ${draftId} not found`);
      }

      return { success: true, message: `Draft state updated to ${newState}` };
    } catch (error) {
      throw new Error(`Failed to update draft state: ${error.message}`);
    }
  }

  // Get draft by ID
  async getDraft(draftId) {
    try {
      const draft = await this.db.collection('drafts').findOne({ id: draftId });
      if (!draft) {
        throw new Error(`Draft ${draftId} not found`);
      }
      return { success: true, draft };
    } catch (error) {
      throw new Error(`Failed to retrieve draft: ${error.message}`);
    }
  }

  // Basic error handling wrapper
  async safeExecute(operation, ...args) {
    try {
      return await operation.apply(this, args);
    } catch (error) {
      console.error('DocumentManagerAPI Error:', error.message);
      return { 
        success: false, 
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // Cleanup connection
  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('✓ MongoDB connection closed');
    }
  }
}

// Export the class and draft states
export { DocumentManagerAPI, DraftStates };