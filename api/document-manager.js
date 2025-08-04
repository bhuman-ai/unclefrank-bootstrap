// UUID implementation - fallback if not available
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

let uuidv4;
try {
  // Try to import uuid, but use fallback if not available
  import('uuid').then(({ v4 }) => {
    uuidv4 = v4;
  }).catch(() => {
    // Already set below
  });
} catch (e) {
  // Will use fallback
}

// Set fallback immediately so it's available synchronously
uuidv4 = generateUUID;

// Draft state schema for document versioning and state tracking
export const DraftStateSchema = {
  id: String,
  projectId: String,
  content: String,
  version: Number,
  status: String, // 'draft', 'validating', 'validated', 'failed', 'merged'
  createdAt: Date,
  updatedAt: Date,
  validationErrors: Array,
  validationPassed: Boolean,
  author: String,
  parentVersion: String,
  mergeConflicts: Array,
  metadata: Object
};

// MongoDB-compatible schema for draft tracking
export function createDraftDocument(content, projectId, author = 'system') {
  return {
    id: uuidv4(),
    projectId: projectId || 'default',
    content,
    version: 1,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    validationErrors: [],
    validationPassed: false,
    author,
    parentVersion: null,
    mergeConflicts: [],
    metadata: {
      wordCount: content.split(' ').length,
      lineCount: content.split('\n').length,
      lastModifiedBy: author
    }
  };
}

// Version control hooks for draft state management
export const versionControlHooks = {
  beforeSave: (draft) => {
    draft.updatedAt = new Date();
    draft.metadata.lastModifiedBy = draft.author;
    return draft;
  },
  
  afterSave: (draft) => {
    console.log(`Draft ${draft.id} saved with status: ${draft.status}`);
    return draft;
  },
  
  beforeValidation: (draft) => {
    draft.status = 'validating';
    draft.validationErrors = [];
    return draft;
  },
  
  afterValidation: (draft, errors) => {
    draft.validationErrors = errors || [];
    draft.validationPassed = errors.length === 0;
    draft.status = draft.validationPassed ? 'validated' : 'failed';
    return draft;
  },
  
  beforeMerge: (draft) => {
    if (!draft.validationPassed) {
      throw new Error('Cannot merge draft that has not passed validation');
    }
    draft.status = 'merging';
    return draft;
  },
  
  afterMerge: (draft) => {
    draft.status = 'merged';
    draft.updatedAt = new Date();
    return draft;
  }
};

// Main document manager API
export class DocumentManagerAPI {
  constructor() {
    this.drafts = new Map();
  }
  
  createDraft(content, projectId, author) {
    const draft = createDraftDocument(content, projectId, author);
    const processedDraft = versionControlHooks.beforeSave(draft);
    this.drafts.set(processedDraft.id, processedDraft);
    versionControlHooks.afterSave(processedDraft);
    return processedDraft;
  }
  
  getDraft(draftId) {
    return this.drafts.get(draftId);
  }
  
  updateDraft(draftId, updates) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    Object.assign(draft, updates);
    const processedDraft = versionControlHooks.beforeSave(draft);
    this.drafts.set(draftId, processedDraft);
    versionControlHooks.afterSave(processedDraft);
    return processedDraft;
  }
  
  validateDraft(draftId, validationErrors = []) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    versionControlHooks.beforeValidation(draft);
    const validatedDraft = versionControlHooks.afterValidation(draft, validationErrors);
    this.drafts.set(draftId, validatedDraft);
    return validatedDraft;
  }
  
  mergeDraft(draftId) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }
    
    versionControlHooks.beforeMerge(draft);
    const mergedDraft = versionControlHooks.afterMerge(draft);
    this.drafts.set(draftId, mergedDraft);
    return mergedDraft;
  }
  
  listDrafts(projectId = null) {
    const allDrafts = Array.from(this.drafts.values());
    return projectId 
      ? allDrafts.filter(draft => draft.projectId === projectId)
      : allDrafts;
  }
}

// Default handler for API endpoint
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const manager = new DocumentManagerAPI();
  
  try {
    switch (req.method) {
      case 'POST':
        const { content, projectId, author } = req.body;
        if (!content) {
          return res.status(400).json({ error: 'Content is required' });
        }
        const draft = manager.createDraft(content, projectId, author);
        res.status(200).json({ success: true, draft });
        break;
        
      case 'GET':
        const { draftId, projectId: queryProjectId } = req.query;
        if (draftId) {
          const draft = manager.getDraft(draftId);
          if (!draft) {
            res.status(404).json({ error: 'Draft not found' });
            return;
          }
          res.status(200).json({ success: true, draft });
        } else {
          const drafts = manager.listDrafts(queryProjectId);
          res.status(200).json({ success: true, drafts });
        }
        break;
        
      case 'PUT':
        const { draftId: updateId } = req.query;
        if (!updateId) {
          return res.status(400).json({ error: 'Draft ID is required' });
        }
        const updates = req.body;
        const updatedDraft = manager.updateDraft(updateId, updates);
        res.status(200).json({ success: true, draft: updatedDraft });
        break;
        
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Document Manager API Error:', error);
    res.status(400).json({ error: error.message });
  }
}