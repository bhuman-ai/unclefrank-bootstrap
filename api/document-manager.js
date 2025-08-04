// FRANK'S DOCUMENT MANAGER - TRACKS PROJECT.MD DRAFTS THROUGH THE SACRED FLOW
// No fake shit - real version control, real validation, real state tracking

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH;

if (!TERRAGON_AUTH) {
  console.error('[DocumentManager] TERRAGON_AUTH not configured');
  throw new Error('TERRAGON_AUTH environment variable required');
}

// FRANK'S RATE LIMITING
const rateLimiter = {
  requests: new Map(),
  windowMs: 60000, // 1 minute
  maxRequests: 20, // 20 requests per minute
  
  check(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }
};

class DocumentManager {
  constructor() {
    this.workingDir = process.cwd();
    this.draftsDir = join(this.workingDir, 'test-drafts');
    this.anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    // Ensure drafts directory exists
    this.ensureDraftsDir();
  }

  async ensureDraftsDir() {
    if (!existsSync(this.draftsDir)) {
      await mkdir(this.draftsDir, { recursive: true });
      console.log('[DocumentManager] Created drafts directory');
    }
  }

  // Create a new Project.md draft with version tracking
  async createDraft(content) {
    const timestamp = Date.now();
    const contentHash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    const draftId = `draft-${timestamp}-${contentHash}`;
    
    // Read current Project.md for comparison
    let currentContent = '';
    try {
      currentContent = await readFile(join(this.workingDir, 'Project.md'), 'utf-8');
    } catch (error) {
      console.log('[DocumentManager] No existing Project.md found');
    }
    
    // Calculate version based on changes
    const version = this.calculateVersion(currentContent, content);
    
    const draft = {
      draftId,
      version,
      content,
      status: 'draft',
      validationResults: {
        ux: { passed: false, issues: [] },
        technical: { passed: false, issues: [] },
        logic: { passed: false, issues: [] }
      },
      tasks: [],
      createdAt: timestamp,
      mergedAt: null,
      metadata: {
        contentHash,
        wordCount: content.split(/\s+/).length,
        lineCount: content.split('\n').length
      }
    };
    
    // Save draft content to file
    const draftPath = join(this.draftsDir, `${draftId}.md`);
    await writeFile(draftPath, content, 'utf-8');
    
    // Save draft metadata
    const metadataPath = join(this.draftsDir, `${draftId}.json`);
    await writeFile(metadataPath, JSON.stringify(draft, null, 2), 'utf-8');
    
    console.log(`[DocumentManager] Created draft: ${draftId}`);
    return draft;
  }

  // Get draft status and validation results
  async getDraftStatus(draftId) {
    try {
      const metadataPath = join(this.draftsDir, `${draftId}.json`);
      const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
      
      // Check if draft files still exist
      const draftPath = join(this.draftsDir, `${draftId}.md`);
      const fileExists = existsSync(draftPath);
      
      return {
        ...metadata,
        fileExists,
        lastModified: fileExists ? (await stat(draftPath)).mtime : null
      };
    } catch (error) {
      throw new Error(`Draft not found: ${draftId}`);
    }
  }

  // List all drafts with their status
  async listDrafts() {
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.draftsDir);
      const drafts = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const draftId = file.replace('.json', '');
            const draft = await this.getDraftStatus(draftId);
            drafts.push(draft);
          } catch (error) {
            console.warn(`[DocumentManager] Skipping invalid draft: ${file}`);
          }
        }
      }
      
      // Sort by creation time, newest first
      return drafts.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('[DocumentManager] Error listing drafts:', error);
      return [];
    }
  }

  // Validate draft using Terragon for real checks
  async validateDraft(draftId) {
    const draft = await this.getDraftStatus(draftId);
    if (draft.status !== 'draft') {
      throw new Error(`Draft ${draftId} is not in draft status`);
    }
    
    console.log(`[DocumentManager] Starting validation for draft: ${draftId}`);
    
    // Update status to validating
    draft.status = 'validating';
    await this.updateDraftMetadata(draftId, draft);
    
    try {
      // Read current Project.md and Interface.md for context
      const projectMd = await this.readProjectMd();
      const interfaceMd = await this.readInterfaceMd();
      
      // Run validation checks using Claude
      const validationResults = await this.runValidationChecks(draft.content, projectMd, interfaceMd);
      
      // Update draft with validation results
      draft.validationResults = validationResults;
      draft.status = this.allValidationsPassed(validationResults) ? 'validated' : 'validation-failed';
      
      await this.updateDraftMetadata(draftId, draft);
      
      console.log(`[DocumentManager] Validation complete for ${draftId}: ${draft.status}`);
      return draft;
    } catch (error) {
      draft.status = 'validation-error';
      draft.validationResults.error = error.message;
      await this.updateDraftMetadata(draftId, draft);
      throw error;
    }
  }

  // Run real validation checks using Claude
  async runValidationChecks(draftContent, currentProject, interfaceSpec) {
    console.log('[DocumentManager] Running real validation checks with Claude...');
    
    const validationPrompt = `You are validating a Project.md draft for contradictions and issues.

CURRENT PROJECT.MD:
${currentProject}

INTERFACE.MD SPEC:
${interfaceSpec}

DRAFT TO VALIDATE:
${draftContent}

Check for these specific issues and return a JSON response:

1. UX Contradictions: Does the draft contradict existing UX patterns or Interface.md rules?
2. Technical Contradictions: Are there technical inconsistencies with current architecture?
3. Logic Contradictions: Do any sections contradict each other within the draft?

Return ONLY JSON in this format:
{
  "ux": {
    "passed": true/false,
    "issues": ["specific issue 1", "specific issue 2"]
  },
  "technical": {
    "passed": true/false,
    "issues": ["specific issue 1", "specific issue 2"]
  },
  "logic": {
    "passed": true/false,
    "issues": ["specific issue 1", "specific issue 2"]
  }
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: validationPrompt
        }]
      });

      const rawResponse = response.content[0].text;
      console.log('[DocumentManager] Claude validation response:', rawResponse.substring(0, 200) + '...');
      
      // Extract JSON from response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid validation response format');
      }
      
      const validationResults = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (!validationResults.ux || !validationResults.technical || !validationResults.logic) {
        throw new Error('Incomplete validation response');
      }
      
      return validationResults;
    } catch (error) {
      console.error('[DocumentManager] Validation error:', error);
      return {
        ux: { passed: false, issues: [`Validation failed: ${error.message}`] },
        technical: { passed: false, issues: [`Validation failed: ${error.message}`] },
        logic: { passed: false, issues: [`Validation failed: ${error.message}`] }
      };
    }
  }

  // Create tasks from validated draft
  async createTasksFromDraft(draftId) {
    const draft = await this.getDraftStatus(draftId);
    
    if (draft.status !== 'validated') {
      throw new Error(`Draft ${draftId} must be validated before creating tasks`);
    }
    
    console.log(`[DocumentManager] Creating tasks from draft ${draftId}`);
    
    // Read draft content
    const draftPath = join(this.draftsDir, `${draftId}.md`);
    const draftContent = await readFile(draftPath, 'utf-8');
    
    // Use Claude to break down draft into executable tasks
    const tasksResponse = await this.anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Break down this Project.md draft into 2-3 executable tasks with clear checkpoints.

DRAFT CONTENT:
${draftContent}

Return ONLY JSON in this format:
{
  "tasks": [
    {
      "id": "task-1",
      "name": "Task Name",
      "objective": "Clear objective",
      "acceptanceCriteria": ["criteria 1", "criteria 2"],
      "checkpoints": [
        {
          "id": "cp1",
          "name": "Checkpoint Name", 
          "objective": "Checkpoint objective",
          "instructions": ["step 1", "step 2"],
          "passCriteria": ["test 1", "test 2"],
          "blocking": true
        }
      ]
    }
  ]
}`
      }]
    });

    const rawResponse = tasksResponse.content[0].text;
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse task breakdown response');
    }
    
    const taskBreakdown = JSON.parse(jsonMatch[0]);
    draft.tasks = taskBreakdown.tasks;
    draft.status = 'tasks-created';
    
    await this.updateDraftMetadata(draftId, draft);
    
    console.log(`[DocumentManager] Created ${taskBreakdown.tasks.length} tasks from draft ${draftId}`);
    return taskBreakdown.tasks;
  }

  // Merge validated draft to production Project.md
  async mergeDraft(draftId) {
    const draft = await this.getDraftStatus(draftId);
    
    if (!['validated', 'tasks-created', 'executing', 'ready-to-merge'].includes(draft.status)) {
      throw new Error(`Draft ${draftId} must be validated before merging`);
    }
    
    console.log(`[DocumentManager] Merging draft ${draftId} to Project.md`);
    
    // Read draft content
    const draftPath = join(this.draftsDir, `${draftId}.md`);
    const draftContent = await readFile(draftPath, 'utf-8');
    
    // Backup current Project.md
    const projectPath = join(this.workingDir, 'Project.md');
    const backupPath = join(this.workingDir, `Project.md.backup.${Date.now()}`);
    
    if (existsSync(projectPath)) {
      const currentContent = await readFile(projectPath, 'utf-8');
      await writeFile(backupPath, currentContent, 'utf-8');
      console.log(`[DocumentManager] Backed up current Project.md to ${backupPath}`);
    }
    
    // Write new Project.md
    await writeFile(projectPath, draftContent, 'utf-8');
    
    // Update draft status
    draft.status = 'merged';
    draft.mergedAt = Date.now();
    await this.updateDraftMetadata(draftId, draft);
    
    console.log(`[DocumentManager] Successfully merged draft ${draftId} to Project.md`);
    return { success: true, backupPath };
  }

  // Helper methods
  calculateVersion(currentContent, newContent) {
    if (!currentContent) return '1.0.0';
    
    // Simple version calculation based on content changes
    const currentLines = currentContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const lineDifference = Math.abs(newLines - currentLines);
    
    if (lineDifference > 50) return '2.0.0'; // Major change
    if (lineDifference > 10) return '1.1.0'; // Minor change
    return '1.0.1'; // Patch change
  }

  allValidationsPassed(validationResults) {
    return validationResults.ux.passed && 
           validationResults.technical.passed && 
           validationResults.logic.passed;
  }

  async updateDraftMetadata(draftId, draft) {
    const metadataPath = join(this.draftsDir, `${draftId}.json`);
    await writeFile(metadataPath, JSON.stringify(draft, null, 2), 'utf-8');
  }

  async readProjectMd() {
    try {
      return await readFile(join(this.workingDir, 'Project.md'), 'utf-8');
    } catch (error) {
      return '# Project.md — Product PRD & Business Logic\n\n## Purpose\nThis document represents the live Product Requirements Document (PRD) for the project.';
    }
  }

  async readInterfaceMd() {
    try {
      return await readFile(join(this.workingDir, 'Interface.md'), 'utf-8');
    } catch (error) {
      return '# Interface.md — Developer Platform UI Specification\n\n## Purpose\nDefines the UI/UX patterns and specifications.';
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;
  
  // FRANK'S RATE LIMITING
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  if (!rateLimiter.check(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Create global document manager instance
  const docManager = global.documentManager || new DocumentManager();
  global.documentManager = docManager;

  try {
    switch (action) {
      case 'create-draft': {
        const { content } = req.body;
        
        if (!content || typeof content !== 'string') {
          return res.status(400).json({ error: 'Content required for draft creation' });
        }
        
        if (content.length < 50) {
          return res.status(400).json({ error: 'Content too short for meaningful draft' });
        }
        
        const draft = await docManager.createDraft(content);
        
        return res.status(200).json({
          success: true,
          draft: {
            draftId: draft.draftId,
            version: draft.version,
            status: draft.status,
            createdAt: draft.createdAt,
            metadata: draft.metadata
          },
          message: `Draft ${draft.draftId} created successfully`
        });
      }

      case 'validate-draft': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required for validation' });
        }
        
        try {
          const validatedDraft = await docManager.validateDraft(draftId);
          
          return res.status(200).json({
            success: true,
            draft: {
              draftId: validatedDraft.draftId,
              status: validatedDraft.status,
              validationResults: validatedDraft.validationResults
            },
            allPassed: docManager.allValidationsPassed(validatedDraft.validationResults),
            message: `Draft ${draftId} validation complete`
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
      }

      case 'get-draft-status': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required' });
        }
        
        try {
          const draft = await docManager.getDraftStatus(draftId);
          
          return res.status(200).json({
            success: true,
            draft: {
              draftId: draft.draftId,
              version: draft.version,
              status: draft.status,
              validationResults: draft.validationResults,
              tasks: draft.tasks,
              createdAt: draft.createdAt,
              mergedAt: draft.mergedAt,
              metadata: draft.metadata,
              fileExists: draft.fileExists,
              lastModified: draft.lastModified
            }
          });
        } catch (error) {
          return res.status(404).json({
            success: false,
            error: error.message
          });
        }
      }

      case 'list-drafts': {
        const drafts = await docManager.listDrafts();
        
        return res.status(200).json({
          success: true,
          drafts: drafts.map(draft => ({
            draftId: draft.draftId,
            version: draft.version,
            status: draft.status,
            createdAt: draft.createdAt,
            mergedAt: draft.mergedAt,
            metadata: draft.metadata,
            validationSummary: {
              ux: draft.validationResults.ux.passed,
              technical: draft.validationResults.technical.passed,
              logic: draft.validationResults.logic.passed
            }
          })),
          count: drafts.length,
          message: `Found ${drafts.length} drafts`
        });
      }

      case 'create-tasks': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required for task creation' });
        }
        
        try {
          const tasks = await docManager.createTasksFromDraft(draftId);
          
          return res.status(200).json({
            success: true,
            draftId,
            tasks,
            count: tasks.length,
            message: `Created ${tasks.length} tasks from draft ${draftId}`
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
      }

      case 'merge-draft': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID required for merge' });
        }
        
        try {
          const result = await docManager.mergeDraft(draftId);
          
          return res.status(200).json({
            success: true,
            draftId,
            backupPath: result.backupPath,
            message: `Draft ${draftId} merged to Project.md successfully`
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
      }

      case 'health-check': {
        return res.status(200).json({
          success: true,
          status: 'healthy',
          draftsDirectory: existsSync(docManager.draftsDir),
          anthropicConfigured: !!CLAUDE_API_KEY,
          terragonConfigured: !!TERRAGON_AUTH,
          timestamp: new Date().toISOString()
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[DocumentManager] API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`
    });
  }
}