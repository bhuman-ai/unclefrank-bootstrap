// FRANK'S DOCUMENT MANAGEMENT SYSTEM
// Tracks Project.md drafts through the sacred flow
// Draft → Validation → Task → Checkpoint → Review → Merge

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// In-memory draft storage (use database in production)
const draftStore = new Map();

// Draft status enum
const DRAFT_STATUS = {
  DRAFT: 'draft',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  TASKS_CREATED: 'tasks-created',
  EXECUTING: 'executing',
  READY_TO_MERGE: 'ready-to-merge',
  MERGED: 'merged'
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, payload } = req.body;

  try {
    switch (action) {
      case 'create-draft': {
        const { content, version = '1.0.0', metadata = {} } = payload;
        
        if (!content) {
          return res.status(400).json({ error: 'Draft content is required' });
        }

        // Generate draft ID
        const timestamp = Date.now();
        const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
        const draftId = `draft-${timestamp}-${hash}`;

        // Create draft object
        const draft = {
          draftId,
          version,
          content,
          status: DRAFT_STATUS.DRAFT,
          validationResults: {
            ux: { passed: false, issues: [], validatedAt: null },
            technical: { passed: false, issues: [], validatedAt: null },
            logic: { passed: false, issues: [], validatedAt: null }
          },
          tasks: [],
          metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mergedAt: null
        };

        // Store draft
        draftStore.set(draftId, draft);

        // Save to file system for persistence
        try {
          const draftsDir = path.join(process.cwd(), 'drafts');
          await fs.mkdir(draftsDir, { recursive: true });
          await fs.writeFile(
            path.join(draftsDir, `${draftId}.json`),
            JSON.stringify(draft, null, 2)
          );
        } catch (error) {
          console.error('Failed to persist draft to file:', error);
        }

        return res.status(201).json({
          success: true,
          draftId,
          draft
        });
      }

      case 'validate-draft': {
        const { draftId, validationType = 'all' } = payload;
        
        const draft = draftStore.get(draftId);
        if (!draft) {
          return res.status(404).json({ error: 'Draft not found' });
        }

        // Update status to validating
        draft.status = DRAFT_STATUS.VALIDATING;
        draft.updatedAt = new Date().toISOString();

        // Perform validation based on type
        const validationPromises = [];
        
        if (validationType === 'all' || validationType === 'ux') {
          validationPromises.push(validateUX(draft));
        }
        if (validationType === 'all' || validationType === 'technical') {
          validationPromises.push(validateTechnical(draft));
        }
        if (validationType === 'all' || validationType === 'logic') {
          validationPromises.push(validateLogic(draft));
        }

        const results = await Promise.all(validationPromises);
        
        // Update validation results
        results.forEach(result => {
          if (result.type === 'ux') {
            draft.validationResults.ux = result;
          } else if (result.type === 'technical') {
            draft.validationResults.technical = result;
          } else if (result.type === 'logic') {
            draft.validationResults.logic = result;
          }
        });

        // Check if all validations passed
        const allPassed = 
          draft.validationResults.ux.passed &&
          draft.validationResults.technical.passed &&
          draft.validationResults.logic.passed;

        draft.status = allPassed ? DRAFT_STATUS.VALIDATED : DRAFT_STATUS.DRAFT;
        draftStore.set(draftId, draft);

        return res.status(200).json({
          success: true,
          draftId,
          status: draft.status,
          validationResults: draft.validationResults,
          allPassed
        });
      }

      case 'get-draft-status': {
        const { draftId } = payload;
        
        const draft = draftStore.get(draftId);
        if (!draft) {
          return res.status(404).json({ error: 'Draft not found' });
        }

        return res.status(200).json({
          success: true,
          draftId,
          status: draft.status,
          version: draft.version,
          validationResults: draft.validationResults,
          tasksCount: draft.tasks.length,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
          mergedAt: draft.mergedAt
        });
      }

      case 'list-drafts': {
        const { status, limit = 10, offset = 0 } = payload;
        
        let drafts = Array.from(draftStore.values());
        
        // Filter by status if provided
        if (status) {
          drafts = drafts.filter(d => d.status === status);
        }
        
        // Sort by creation date (newest first)
        drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Paginate
        const paginatedDrafts = drafts.slice(offset, offset + limit);
        
        return res.status(200).json({
          success: true,
          drafts: paginatedDrafts.map(d => ({
            draftId: d.draftId,
            version: d.version,
            status: d.status,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
            mergedAt: d.mergedAt,
            validationPassed: 
              d.validationResults.ux.passed &&
              d.validationResults.technical.passed &&
              d.validationResults.logic.passed
          })),
          total: drafts.length,
          limit,
          offset
        });
      }

      case 'merge-draft': {
        const { draftId, approvedBy } = payload;
        
        const draft = draftStore.get(draftId);
        if (!draft) {
          return res.status(404).json({ error: 'Draft not found' });
        }

        // Check if draft is ready to merge
        if (draft.status !== DRAFT_STATUS.READY_TO_MERGE) {
          return res.status(400).json({ 
            error: 'Draft is not ready to merge',
            currentStatus: draft.status,
            requiredStatus: DRAFT_STATUS.READY_TO_MERGE
          });
        }

        // Check if human approval is provided
        if (!approvedBy) {
          return res.status(400).json({ 
            error: 'Human approval required for merge',
            message: 'approvedBy field must contain the approver identifier'
          });
        }

        try {
          // Read current Project.md
          const projectMdPath = path.join(process.cwd(), 'Project.md');
          const currentContent = await fs.readFile(projectMdPath, 'utf-8').catch(() => '');
          
          // Backup current Project.md
          const backupsDir = path.join(process.cwd(), 'backups');
          await fs.mkdir(backupsDir, { recursive: true });
          const backupPath = path.join(backupsDir, `Project-${Date.now()}.md`);
          await fs.writeFile(backupPath, currentContent);
          
          // Write new Project.md
          await fs.writeFile(projectMdPath, draft.content);
          
          // Update draft status
          draft.status = DRAFT_STATUS.MERGED;
          draft.mergedAt = new Date().toISOString();
          draft.metadata.approvedBy = approvedBy;
          draft.metadata.backupPath = backupPath;
          draftStore.set(draftId, draft);
          
          return res.status(200).json({
            success: true,
            draftId,
            mergedAt: draft.mergedAt,
            approvedBy,
            backupPath,
            message: 'Draft successfully merged to Project.md'
          });
        } catch (error) {
          return res.status(500).json({
            error: 'Failed to merge draft',
            details: error.message
          });
        }
      }

      case 'update-draft-status': {
        const { draftId, status, tasks } = payload;
        
        const draft = draftStore.get(draftId);
        if (!draft) {
          return res.status(404).json({ error: 'Draft not found' });
        }

        // Validate status transition
        const validTransitions = {
          [DRAFT_STATUS.DRAFT]: [DRAFT_STATUS.VALIDATING, DRAFT_STATUS.VALIDATED],
          [DRAFT_STATUS.VALIDATING]: [DRAFT_STATUS.DRAFT, DRAFT_STATUS.VALIDATED],
          [DRAFT_STATUS.VALIDATED]: [DRAFT_STATUS.TASKS_CREATED],
          [DRAFT_STATUS.TASKS_CREATED]: [DRAFT_STATUS.EXECUTING],
          [DRAFT_STATUS.EXECUTING]: [DRAFT_STATUS.READY_TO_MERGE],
          [DRAFT_STATUS.READY_TO_MERGE]: [DRAFT_STATUS.MERGED],
          [DRAFT_STATUS.MERGED]: []
        };

        if (!validTransitions[draft.status].includes(status)) {
          return res.status(400).json({
            error: 'Invalid status transition',
            currentStatus: draft.status,
            attemptedStatus: status,
            allowedTransitions: validTransitions[draft.status]
          });
        }

        draft.status = status;
        draft.updatedAt = new Date().toISOString();
        
        if (tasks) {
          draft.tasks = tasks;
        }
        
        draftStore.set(draftId, draft);
        
        return res.status(200).json({
          success: true,
          draftId,
          status: draft.status,
          updatedAt: draft.updatedAt
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[Document Manager] Error:', error);
    return res.status(500).json({
      error: 'Document management error',
      details: error.message
    });
  }
}

// Validation functions
async function validateUX(draft) {
  const issues = [];
  const content = draft.content.toLowerCase();
  
  // Check for user-facing inconsistencies
  if (content.includes('user') && !content.includes('experience')) {
    issues.push('Mentions users but lacks experience considerations');
  }
  
  if (content.includes('interface') && !content.includes('design')) {
    issues.push('Mentions interface without design specifications');
  }
  
  // Check for accessibility mentions
  if (!content.includes('accessibility') && content.includes('ui')) {
    issues.push('UI mentioned without accessibility considerations');
  }
  
  return {
    type: 'ux',
    passed: issues.length === 0,
    issues,
    validatedAt: new Date().toISOString()
  };
}

async function validateTechnical(draft) {
  const issues = [];
  const content = draft.content;
  
  // Check for technical feasibility
  if (content.includes('real-time') && !content.includes('websocket')) {
    issues.push('Real-time features mentioned without WebSocket specification');
  }
  
  if (content.includes('database') && !content.includes('schema')) {
    issues.push('Database operations without schema definition');
  }
  
  if (content.includes('api') && !content.includes('endpoint')) {
    issues.push('API mentioned without endpoint specifications');
  }
  
  // Check for security considerations
  if (content.includes('authentication') && !content.includes('security')) {
    issues.push('Authentication without security considerations');
  }
  
  return {
    type: 'technical',
    passed: issues.length === 0,
    issues,
    validatedAt: new Date().toISOString()
  };
}

async function validateLogic(draft) {
  const issues = [];
  const content = draft.content;
  const lines = content.split('\n');
  
  // Check for logical contradictions
  const promises = [];
  const implementations = [];
  
  lines.forEach(line => {
    if (line.includes('will') || line.includes('shall')) {
      promises.push(line);
    }
    if (line.includes('implements') || line.includes('creates')) {
      implementations.push(line);
    }
  });
  
  // Check if promises have corresponding implementations
  if (promises.length > implementations.length * 2) {
    issues.push('More promises than implementations - potential over-commitment');
  }
  
  // Check for circular dependencies
  if (content.includes('depends on') && content.includes('circular')) {
    issues.push('Potential circular dependency detected');
  }
  
  // Check for conflicting states
  if (content.includes('immutable') && content.includes('mutable')) {
    issues.push('Conflicting state management approaches');
  }
  
  return {
    type: 'logic',
    passed: issues.length === 0,
    issues,
    validatedAt: new Date().toISOString()
  };
}