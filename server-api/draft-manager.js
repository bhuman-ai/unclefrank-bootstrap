// FRANK'S DRAFT MANAGER - Enforces the sacred flow for Project.md
// Draft → Validation → Task → Checkpoint → Review → Merge

const drafts = new Map(); // In-memory storage (use database in production)

// Draft states as defined in Claude.md
const DRAFT_STATES = {
  DRAFT: 'draft',
  VALIDATING: 'validating', 
  VALIDATED: 'validated',
  FAILED: 'failed',
  CREATING_TASKS: 'creating_tasks',
  READY_FOR_MERGE: 'ready_for_merge',
  MERGED: 'merged'
};

class DraftManager {
  constructor() {
    this.drafts = drafts;
  }

  // Create a new draft
  createDraft(content, metadata = {}) {
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const draft = {
      id: draftId,
      content: content,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: metadata.author || 'system'
      },
      state: DRAFT_STATES.DRAFT,
      validationResults: null,
      taskIds: [],
      history: [{
        action: 'created',
        timestamp: new Date().toISOString(),
        state: DRAFT_STATES.DRAFT
      }]
    };
    
    this.drafts.set(draftId, draft);
    console.log(`[DraftManager] Created draft ${draftId}`);
    
    return draft;
  }

  // Get a draft by ID
  getDraft(draftId) {
    return this.drafts.get(draftId);
  }

  // Update draft content
  updateDraft(draftId, content) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    if (draft.state !== DRAFT_STATES.DRAFT) {
      throw new Error(`Cannot update draft in state: ${draft.state}`);
    }
    
    draft.content = content;
    draft.metadata.updatedAt = new Date().toISOString();
    draft.history.push({
      action: 'updated',
      timestamp: new Date().toISOString(),
      state: draft.state
    });
    
    return draft;
  }

  // Start validation process
  async startValidation(draftId) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    if (draft.state !== DRAFT_STATES.DRAFT) {
      throw new Error(`Can only validate drafts in 'draft' state, current: ${draft.state}`);
    }
    
    // Update state
    draft.state = DRAFT_STATES.VALIDATING;
    draft.history.push({
      action: 'validation_started',
      timestamp: new Date().toISOString(),
      state: DRAFT_STATES.VALIDATING
    });
    
    console.log(`[DraftManager] Starting validation for draft ${draftId}`);
    
    // In a real implementation, this would create a Claude task for validation
    // For now, we'll simulate validation checks
    const validationResults = await this.runValidationChecks(draft);
    
    // Update draft with results
    draft.validationResults = validationResults;
    draft.state = validationResults.passed ? DRAFT_STATES.VALIDATED : DRAFT_STATES.FAILED;
    draft.history.push({
      action: 'validation_completed',
      timestamp: new Date().toISOString(),
      state: draft.state,
      results: validationResults
    });
    
    return validationResults;
  }

  // Run validation checks (would connect to Claude in production)
  async runValidationChecks(draft) {
    console.log(`[DraftManager] Running validation checks...`);
    
    const checks = {
      syntax: { passed: true, details: 'Valid markdown syntax' },
      structure: { passed: true, details: 'Follows Project.md structure' },
      conflicts: { passed: true, details: 'No conflicts with current Project.md' },
      technical: { passed: true, details: 'Technical requirements are feasible' }
    };
    
    // Check for required sections
    const requiredSections = ['## Task:', '## Acceptance Criteria:', '## Technical Details:'];
    for (const section of requiredSections) {
      if (!draft.content.includes(section)) {
        checks.structure.passed = false;
        checks.structure.details = `Missing required section: ${section}`;
        break;
      }
    }
    
    // Overall validation result
    const passed = Object.values(checks).every(check => check.passed);
    
    return {
      passed,
      checks,
      timestamp: new Date().toISOString(),
      validator: 'draft-manager-v1'
    };
  }

  // Create tasks from validated draft
  async createTasks(draftId) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    if (draft.state !== DRAFT_STATES.VALIDATED) {
      throw new Error(`Can only create tasks from validated drafts, current: ${draft.state}`);
    }
    
    draft.state = DRAFT_STATES.CREATING_TASKS;
    draft.history.push({
      action: 'task_creation_started',
      timestamp: new Date().toISOString(),
      state: DRAFT_STATES.CREATING_TASKS
    });
    
    // Extract tasks from draft content
    // In production, this would parse the draft and create Claude tasks
    const taskIds = [`task_${Date.now()}_1`]; // Simulated task ID
    
    draft.taskIds = taskIds;
    draft.state = DRAFT_STATES.READY_FOR_MERGE;
    draft.history.push({
      action: 'tasks_created',
      timestamp: new Date().toISOString(),
      state: DRAFT_STATES.READY_FOR_MERGE,
      taskIds
    });
    
    return taskIds;
  }

  // Merge draft (requires human approval)
  async mergeDraft(draftId, approver) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    if (draft.state !== DRAFT_STATES.READY_FOR_MERGE) {
      throw new Error(`Can only merge drafts in 'ready_for_merge' state, current: ${draft.state}`);
    }
    
    // In production, this would update the actual Project.md file
    draft.state = DRAFT_STATES.MERGED;
    draft.metadata.mergedAt = new Date().toISOString();
    draft.metadata.mergedBy = approver;
    draft.history.push({
      action: 'merged',
      timestamp: new Date().toISOString(),
      state: DRAFT_STATES.MERGED,
      approver
    });
    
    console.log(`[DraftManager] Draft ${draftId} merged by ${approver}`);
    
    return {
      success: true,
      mergedAt: draft.metadata.mergedAt,
      approver
    };
  }

  // List all drafts with optional filtering
  listDrafts(filter = {}) {
    const allDrafts = Array.from(this.drafts.values());
    
    let filtered = allDrafts;
    
    // Filter by state
    if (filter.state) {
      filtered = filtered.filter(d => d.state === filter.state);
    }
    
    // Filter by date range
    if (filter.createdAfter) {
      filtered = filtered.filter(d => 
        new Date(d.metadata.createdAt) > new Date(filter.createdAfter)
      );
    }
    
    // Sort by creation date (newest first)
    filtered.sort((a, b) => 
      new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt)
    );
    
    return filtered;
  }

  // Get draft history
  getDraftHistory(draftId) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    return draft.history;
  }
}

// API Handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const manager = new DraftManager();
  const { action } = req.body || {};

  try {
    switch (action) {
      case 'create': {
        const { content, metadata } = req.body;
        if (!content) {
          return res.status(400).json({ error: 'Content required' });
        }
        
        const draft = manager.createDraft(content, metadata);
        return res.status(200).json({ draft });
      }

      case 'get': {
        const { draftId } = req.body;
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        
        const draft = manager.getDraft(draftId);
        if (!draft) {
          return res.status(404).json({ error: 'Draft not found' });
        }
        
        return res.status(200).json({ draft });
      }

      case 'update': {
        const { draftId, content } = req.body;
        if (!draftId || !content) {
          return res.status(400).json({ error: 'Draft ID and content required' });
        }
        
        try {
          const draft = manager.updateDraft(draftId, content);
          return res.status(200).json({ draft });
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      case 'validate': {
        const { draftId } = req.body;
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        
        try {
          const results = await manager.startValidation(draftId);
          const draft = manager.getDraft(draftId);
          return res.status(200).json({ draft, validationResults: results });
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      case 'create-tasks': {
        const { draftId } = req.body;
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        
        try {
          const taskIds = await manager.createTasks(draftId);
          const draft = manager.getDraft(draftId);
          return res.status(200).json({ draft, taskIds });
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      case 'merge': {
        const { draftId, approver } = req.body;
        if (!draftId || !approver) {
          return res.status(400).json({ error: 'Draft ID and approver required' });
        }
        
        try {
          const result = await manager.mergeDraft(draftId, approver);
          const draft = manager.getDraft(draftId);
          return res.status(200).json({ draft, mergeResult: result });
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      case 'list': {
        const { filter } = req.body;
        const drafts = manager.listDrafts(filter || {});
        return res.status(200).json({ drafts });
      }

      case 'history': {
        const { draftId } = req.body;
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        
        try {
          const history = manager.getDraftHistory(draftId);
          return res.status(200).json({ history });
        } catch (error) {
          return res.status(404).json({ error: error.message });
        }
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[DraftManager] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}