// Document Manager API - Foundation for state tracking and version control

// Draft State Interface
const DraftState = {
  DRAFT: 'draft',
  VALIDATING: 'validating', 
  VALIDATED: 'validated',
  TASK_BREAKDOWN: 'task_breakdown',
  EXECUTING: 'executing',
  REVIEW: 'review',
  APPROVED: 'approved',
  MERGED: 'merged',
  REJECTED: 'rejected'
};

// MongoDB Schema for Draft Tracking
const draftSchema = {
  id: String,
  projectId: String,
  title: String,
  content: String,
  state: {
    type: String,
    enum: Object.values(DraftState),
    default: DraftState.DRAFT
  },
  version: {
    type: Number,
    default: 1
  },
  author: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  validationResults: {
    passed: Boolean,
    errors: [String],
    warnings: [String]
  },
  tasks: [{
    id: String,
    title: String,
    status: String,
    checkpoints: [{
      id: String,
      description: String,
      passed: Boolean,
      testResults: String
    }]
  }],
  metadata: {
    parentVersion: Number,
    conflictsWith: [String],
    dependencies: [String]
  }
};

// Version Control Helpers
class VersionControlHelpers {
  static generateDraftId() {
    return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createVersion(baseContent, changes) {
    return {
      content: this.applyChanges(baseContent, changes),
      version: this.getNextVersion(baseContent),
      timestamp: new Date().toISOString()
    };
  }

  static applyChanges(content, changes) {
    // Simple diff application - would need more sophisticated merging in production
    return changes.reduce((result, change) => {
      switch (change.type) {
        case 'insert':
          return result.slice(0, change.position) + change.text + result.slice(change.position);
        case 'delete':
          return result.slice(0, change.start) + result.slice(change.end);
        case 'replace':
          return result.slice(0, change.start) + change.text + result.slice(change.end);
        default:
          return result;
      }
    }, content);
  }

  static getNextVersion(content) {
    // Extract version from content or default to 1
    const versionMatch = content.match(/version:\s*(\d+)/i);
    return versionMatch ? parseInt(versionMatch[1]) + 1 : 1;
  }

  static createDraftSnapshot(draft) {
    return {
      id: draft.id,
      content: draft.content,
      state: draft.state,
      version: draft.version,
      timestamp: new Date().toISOString(),
      checksum: this.generateChecksum(draft.content)
    };
  }

  static generateChecksum(content) {
    // Simple hash for content verification
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  static validateStateTransition(currentState, newState) {
    const validTransitions = {
      [DraftState.DRAFT]: [DraftState.VALIDATING, DraftState.REJECTED],
      [DraftState.VALIDATING]: [DraftState.VALIDATED, DraftState.REJECTED, DraftState.DRAFT],
      [DraftState.VALIDATED]: [DraftState.TASK_BREAKDOWN, DraftState.REJECTED],
      [DraftState.TASK_BREAKDOWN]: [DraftState.EXECUTING, DraftState.REJECTED],
      [DraftState.EXECUTING]: [DraftState.REVIEW, DraftState.REJECTED],
      [DraftState.REVIEW]: [DraftState.APPROVED, DraftState.REJECTED, DraftState.DRAFT],
      [DraftState.APPROVED]: [DraftState.MERGED],
      [DraftState.MERGED]: [], // Terminal state
      [DraftState.REJECTED]: [DraftState.DRAFT] // Can restart
    };

    const allowedTransitions = validTransitions[currentState] || [];
    return allowedTransitions.includes(newState);
  }
}

// Core Document Manager Functions
class DocumentManager {
  static createDraft(projectId, content, author) {
    return {
      id: VersionControlHelpers.generateDraftId(),
      projectId,
      title: this.extractTitle(content),
      content,
      state: DraftState.DRAFT,
      version: 1,
      author,
      createdAt: new Date(),
      updatedAt: new Date(),
      validationResults: null,
      tasks: [],
      metadata: {
        parentVersion: null,
        conflictsWith: [],
        dependencies: []
      }
    };
  }

  static updateDraftState(draft, newState, validationResults = null) {
    if (!VersionControlHelpers.validateStateTransition(draft.state, newState)) {
      throw new Error(`Invalid state transition from ${draft.state} to ${newState}`);
    }

    return {
      ...draft,
      state: newState,
      updatedAt: new Date(),
      validationResults: validationResults || draft.validationResults
    };
  }

  static extractTitle(content) {
    // Extract title from markdown content
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Draft';
  }

  static getDraftHistory(draftId) {
    // Would query database for draft history
    return {
      draftId,
      history: [],
      totalVersions: 0
    };
  }
}

// Export all components
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'POST':
        return await handleCreateDraft(req, res);
      case 'PUT':
        return await handleUpdateDraft(req, res);
      case 'GET':
        return await handleGetDraft(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Document Manager error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function handleCreateDraft(req, res) {
  const { projectId, content, author } = req.body;

  if (!projectId || !content || !author) {
    return res.status(400).json({
      error: 'Missing required fields: projectId, content, and author'
    });
  }

  try {
    const draft = DocumentManager.createDraft(projectId, content, author);
    
    res.status(201).json({
      success: true,
      draft: {
        id: draft.id,
        projectId: draft.projectId,
        title: draft.title,
        state: draft.state,
        version: draft.version,
        createdAt: draft.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create draft',
      details: error.message
    });
  }
}

async function handleUpdateDraft(req, res) {
  const { draftId, newState, validationResults } = req.body;

  if (!draftId || !newState) {
    return res.status(400).json({
      error: 'Missing required fields: draftId and newState'
    });
  }

  try {
    // In a real implementation, would fetch from database
    const mockDraft = {
      id: draftId,
      state: DraftState.DRAFT,
      // ... other properties
    };

    const updatedDraft = DocumentManager.updateDraftState(mockDraft, newState, validationResults);
    
    res.status(200).json({
      success: true,
      draft: {
        id: updatedDraft.id,
        state: updatedDraft.state,
        updatedAt: updatedDraft.updatedAt
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Failed to update draft',
      details: error.message
    });
  }
}

async function handleGetDraft(req, res) {
  const { draftId } = req.query;

  if (!draftId) {
    return res.status(400).json({
      error: 'Missing required query parameter: draftId'
    });
  }

  try {
    const history = DocumentManager.getDraftHistory(draftId);
    
    res.status(200).json({
      success: true,
      draftId,
      history
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get draft',
      details: error.message
    });
  }
}

// Export classes and constants for external use
export { DraftState, DocumentManager, VersionControlHelpers, draftSchema };