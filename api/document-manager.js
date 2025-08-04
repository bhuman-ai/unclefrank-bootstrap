import { promises as fs } from 'fs';
import path from 'path';

/**
 * Document Manager API - Base Implementation
 * Handles draft document storage and state tracking
 */

// Draft state interface
const DraftState = {
  DRAFT: 'draft',
  VALIDATING: 'validating', 
  VALIDATED: 'validated',
  TASK_DECOMPOSED: 'task_decomposed',
  EXECUTING: 'executing',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

// Storage paths
const STORAGE_ROOT = process.env.STORAGE_ROOT || '/tmp/document-manager';
const DRAFTS_DIR = path.join(STORAGE_ROOT, 'drafts');
const STATE_DIR = path.join(STORAGE_ROOT, 'state');

class DocumentManager {
  constructor() {
    this.initialized = false;
  }

  async initStorage() {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(DRAFTS_DIR, { recursive: true });
      await fs.mkdir(STATE_DIR, { recursive: true });
      this.initialized = true;
    } catch (error) {
      console.error('Storage initialization failed:', error);
      throw new Error('Failed to initialize document storage');
    }
  }

  /**
   * Create a new draft document
   */
  async createDraft(content, metadata = {}) {
    await this.initStorage();
    try {
      const draftId = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const draft = {
        id: draftId,
        content,
        metadata,
        state: DraftState.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };

      await this.saveDraft(draft);
      await this.saveState(draftId, {
        state: DraftState.DRAFT,
        history: [{ state: DraftState.DRAFT, timestamp: draft.createdAt }]
      });

      return draft;
    } catch (error) {
      console.error('Failed to create draft:', error);
      throw new Error('Draft creation failed');
    }
  }

  /**
   * Update draft content
   */
  async updateDraft(draftId, content, metadata = {}) {
    await this.initStorage();
    try {
      const existing = await this.getDraft(draftId);
      if (!existing) {
        throw new Error(`Draft ${draftId} not found`);
      }

      const updated = {
        ...existing,
        content,
        metadata: { ...existing.metadata, ...metadata },
        updatedAt: new Date().toISOString(),
        version: existing.version + 1
      };

      await this.saveDraft(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update draft:', error);
      throw new Error('Draft update failed');
    }
  }

  /**
   * Get draft by ID
   */
  async getDraft(draftId) {
    await this.initStorage();
    try {
      const draftPath = path.join(DRAFTS_DIR, `${draftId}.json`);
      const content = await fs.readFile(draftPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('Failed to get draft:', error);
      throw new Error('Draft retrieval failed');
    }
  }

  /**
   * Update draft state
   */
  async updateState(draftId, newState, context = {}) {
    await this.initStorage();
    try {
      const currentState = await this.getState(draftId);
      if (!currentState) {
        throw new Error(`State for draft ${draftId} not found`);
      }

      const updatedState = {
        ...currentState,
        state: newState,
        context: { ...currentState.context, ...context },
        updatedAt: new Date().toISOString(),
        history: [
          ...currentState.history,
          { 
            state: newState, 
            timestamp: new Date().toISOString(),
            context 
          }
        ]
      };

      await this.saveState(draftId, updatedState);
      return updatedState;
    } catch (error) {
      console.error('Failed to update state:', error);
      throw new Error('State update failed');
    }
  }

  /**
   * Get current state for draft
   */
  async getState(draftId) {
    await this.initStorage();
    try {
      const statePath = path.join(STATE_DIR, `${draftId}-state.json`);
      const content = await fs.readFile(statePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('Failed to get state:', error);
      throw new Error('State retrieval failed');
    }
  }

  /**
   * List all drafts with optional state filter
   */
  async listDrafts(stateFilter = null) {
    await this.initStorage();
    try {
      const files = await fs.readdir(DRAFTS_DIR);
      const drafts = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const draftId = file.replace('.json', '');
          const draft = await this.getDraft(draftId);
          const state = await this.getState(draftId);
          
          if (draft && (!stateFilter || state?.state === stateFilter)) {
            drafts.push({ ...draft, currentState: state?.state });
          }
        }
      }

      return drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('Failed to list drafts:', error);
      throw new Error('Draft listing failed');
    }
  }

  /**
   * Delete draft and its state
   */
  async deleteDraft(draftId) {
    await this.initStorage();
    try {
      const draftPath = path.join(DRAFTS_DIR, `${draftId}.json`);
      const statePath = path.join(STATE_DIR, `${draftId}-state.json`);
      
      await Promise.all([
        fs.unlink(draftPath).catch(() => {}), // Ignore if not exists
        fs.unlink(statePath).catch(() => {})   // Ignore if not exists
      ]);

      return true;
    } catch (error) {
      console.error('Failed to delete draft:', error);
      throw new Error('Draft deletion failed');
    }
  }

  // Private methods
  async saveDraft(draft) {
    const draftPath = path.join(DRAFTS_DIR, `${draft.id}.json`);
    await fs.writeFile(draftPath, JSON.stringify(draft, null, 2));
  }

  async saveState(draftId, state) {
    const statePath = path.join(STATE_DIR, `${draftId}-state.json`);
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Test storage connection
   */
  async testConnection() {
    await this.initStorage();
    try {
      // Test write/read cycle
      const testId = `test-${Date.now()}`;
      const testDraft = {
        id: testId,
        content: 'Connection test',
        state: DraftState.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };

      await this.saveDraft(testDraft);
      const retrieved = await this.getDraft(testId);
      await this.deleteDraft(testId);

      return retrieved !== null && retrieved.id === testId;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
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
    const docManager = new DocumentManager();
    const { action } = req.query;
    const { draftId, content, metadata, state, context, stateFilter } = req.body || {};

    switch (action) {
      case 'create':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!content) {
          return res.status(400).json({ error: 'Content required' });
        }
        const draft = await docManager.createDraft(content, metadata);
        return res.status(201).json({ success: true, draft });

      case 'update':
        if (req.method !== 'PUT') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!draftId || !content) {
          return res.status(400).json({ error: 'Draft ID and content required' });
        }
        const updated = await docManager.updateDraft(draftId, content, metadata);
        return res.status(200).json({ success: true, draft: updated });

      case 'get':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        const retrieved = await docManager.getDraft(draftId);
        if (!retrieved) {
          return res.status(404).json({ error: 'Draft not found' });
        }
        return res.status(200).json({ success: true, draft: retrieved });

      case 'updateState':
        if (req.method !== 'PATCH') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!draftId || !state) {
          return res.status(400).json({ error: 'Draft ID and state required' });
        }
        const updatedState = await docManager.updateState(draftId, state, context);
        return res.status(200).json({ success: true, state: updatedState });

      case 'getState':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        const currentState = await docManager.getState(draftId);
        if (!currentState) {
          return res.status(404).json({ error: 'State not found' });
        }
        return res.status(200).json({ success: true, state: currentState });

      case 'list':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const drafts = await docManager.listDrafts(stateFilter);
        return res.status(200).json({ success: true, drafts });

      case 'delete':
        if (req.method !== 'DELETE') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        await docManager.deleteDraft(draftId);
        return res.status(200).json({ success: true });

      case 'test':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const testResult = await docManager.testConnection();
        return res.status(200).json({ 
          success: true, 
          connected: testResult,
          message: testResult ? 'Storage connection successful' : 'Storage connection failed'
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('Document Manager API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Export the DocumentManager class and DraftState for use in other modules
export { DocumentManager, DraftState };