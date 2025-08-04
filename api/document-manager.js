// FRANK'S DOCUMENT MANAGER - TRACKS PROJECT.MD DRAFTS THROUGH THE SACRED FLOW
// Real version control, real validation, real state tracking - no fake shit

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

// FRANK'S RATE LIMITING
const rateLimiter = {
  requests: new Map(),
  windowMs: 60000, // 1 minute
  maxRequests: 50, // 50 requests per minute
  
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
    this.draftsDir = join(this.workingDir, 'drafts');
    this.versionsDir = join(this.workingDir, 'drafts', 'versions');
    this.validateionsDir = join(this.workingDir, 'drafts', 'validations');
    
    // FRANK'S LIMITS
    this.MAX_DRAFTS = 50;
    this.MAX_DRAFT_SIZE = 100000; // 100KB
    this.MAX_VALIDATION_TIME = 30000; // 30 seconds
    
    // Initialize directories
    this.initializeDirs();
  }
  
  async initializeDirs() {
    try {
      await mkdir(this.draftsDir, { recursive: true });
      await mkdir(this.versionsDir, { recursive: true });
      await mkdir(this.validateionsDir, { recursive: true });
    } catch (error) {
      console.error('[DocManager] Failed to initialize directories:', error.message);
    }
  }
  
  // Generate draft ID with timestamp and hash
  generateDraftId(content) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    return `draft-${timestamp}-${hash}`;
  }
  
  // Create new Project.md draft
  async createDraft(content, metadata = {}) {
    console.log('[DocManager] 🆕 Creating new draft...');
    
    // FRANK'S VALIDATION
    if (!content || typeof content !== 'string') {
      throw new Error('Draft content is required and must be a string');
    }
    
    if (content.length > this.MAX_DRAFT_SIZE) {
      throw new Error(`Draft too large (${content.length} chars, max ${this.MAX_DRAFT_SIZE})`);
    }
    
    // Check draft limit
    const existingDrafts = await this.listDrafts();
    if (existingDrafts.length >= this.MAX_DRAFTS) {
      throw new Error(`Maximum drafts reached (${this.MAX_DRAFTS})`);
    }
    
    const draftId = this.generateDraftId(content);
    const timestamp = Date.now();
    
    const draft = {
      draftId,
      version: "1.0.0",
      content,
      status: "draft",
      validationResults: {
        ux: { passed: false, issues: [], lastChecked: null },
        technical: { passed: false, issues: [], lastChecked: null },
        logic: { passed: false, issues: [], lastChecked: null }
      },
      tasks: [],
      metadata: {
        title: metadata.title || 'Untitled Draft',
        description: metadata.description || '',
        author: metadata.author || 'system',
        ...metadata
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      mergedAt: null
    };
    
    // Save draft
    const draftPath = join(this.draftsDir, `${draftId}.json`);
    await writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf-8');
    
    // Save content separately for easy access
    const contentPath = join(this.versionsDir, `${draftId}.md`);
    await writeFile(contentPath, content, 'utf-8');
    
    console.log(`[DocManager] ✅ Draft created: ${draftId}`);
    return draft;
  }
  
  // Validate draft using Terragon integration
  async validateDraft(draftId) {
    console.log(`[DocManager] 🔍 Validating draft: ${draftId}`);
    
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    
    if (draft.status !== 'draft') {
      throw new Error(`Draft ${draftId} cannot be validated (current status: ${draft.status})`);
    }
    
    // Update status to validating
    draft.status = 'validating';
    draft.updatedAt = Date.now();
    await this.saveDraft(draft);
    
    try {
      // Run real validation checks using Terragon
      const validationResults = await this.runValidationChecks(draft);
      
      // Update draft with results
      draft.validationResults = validationResults;
      draft.status = this.determineValidationStatus(validationResults);
      draft.updatedAt = Date.now();
      
      // Save validation log
      const validationLog = {
        draftId,
        timestamp: Date.now(),
        results: validationResults,
        status: draft.status
      };
      
      const logPath = join(this.validateionsDir, `${draftId}-${Date.now()}.json`);
      await writeFile(logPath, JSON.stringify(validationLog, null, 2), 'utf-8');
      
      await this.saveDraft(draft);
      
      console.log(`[DocManager] ✅ Validation complete: ${draft.status}`);
      return draft;
      
    } catch (error) {
      console.error(`[DocManager] ❌ Validation failed:`, error.message);
      draft.status = 'draft';
      draft.validationResults.error = error.message;
      draft.updatedAt = Date.now();
      await this.saveDraft(draft);
      throw error;
    }
  }
  
  // Run actual validation checks using Terragon
  async runValidationChecks(draft) {
    console.log('[DocManager] 🧠 Running Terragon validation checks...');
    
    const validationPromises = [
      this.validateUX(draft),
      this.validateTechnical(draft),
      this.validateLogic(draft)
    ];
    
    // Run validations in parallel with timeout
    const results = await Promise.allSettled(
      validationPromises.map(promise => 
        this.withTimeout(promise, this.MAX_VALIDATION_TIME)
      )
    );
    
    const [uxResult, technicalResult, logicResult] = results;
    
    return {
      ux: uxResult.status === 'fulfilled' ? uxResult.value : {
        passed: false,
        issues: [`Validation timeout or error: ${uxResult.reason?.message || 'Unknown error'}`],
        lastChecked: Date.now()
      },
      technical: technicalResult.status === 'fulfilled' ? technicalResult.value : {
        passed: false,
        issues: [`Validation timeout or error: ${technicalResult.reason?.message || 'Unknown error'}`],
        lastChecked: Date.now()
      },
      logic: logicResult.status === 'fulfilled' ? logicResult.value : {
        passed: false,
        issues: [`Validation timeout or error: ${logicResult.reason?.message || 'Unknown error'}`],
        lastChecked: Date.now()
      }
    };
  }
  
  // UX validation using Terragon
  async validateUX(draft) {
    console.log('[DocManager] 🎨 Validating UX consistency...');
    
    try {
      // Create Terragon validation request
      const validationPrompt = `
You are Uncle Frank's UX Validator. Analyze this Project.md draft for UX consistency issues.

DRAFT CONTENT:
${draft.content}

FRANK'S UX RULES:
1. User personas must be clearly defined
2. User journeys must be logical and complete
3. Feature descriptions must include user value
4. UX patterns must be consistent throughout
5. No contradictory user experience statements

Check for:
- Missing or vague user personas
- Incomplete user journeys
- Features without clear user value
- Inconsistent UX terminology
- Contradictory user experience claims

Respond with ONLY a JSON object:
{
  "passed": boolean,
  "issues": ["specific issue descriptions"],
  "suggestions": ["how to fix each issue"]
}
`;

      const result = await this.callTerragonValidator(validationPrompt, 'ux');
      return {
        ...result,
        lastChecked: Date.now()
      };
      
    } catch (error) {
      console.error('[DocManager] UX validation error:', error.message);
      return {
        passed: false,
        issues: [`UX validation failed: ${error.message}`],
        suggestions: ['Fix validation system connectivity'],
        lastChecked: Date.now()
      };
    }
  }
  
  // Technical validation using Terragon
  async validateTechnical(draft) {
    console.log('[DocManager] ⚙️ Validating technical feasibility...');
    
    try {
      const validationPrompt = `
You are Uncle Frank's Technical Validator. Analyze this Project.md draft for technical feasibility issues.

DRAFT CONTENT:
${draft.content}

FRANK'S TECHNICAL RULES:
1. API integrations must be realistic and available
2. Database schemas must be well-designed
3. Technical constraints must be acknowledged
4. No impossible technical claims
5. Performance considerations must be addressed

Check for:
- Unrealistic API integrations
- Poor database design
- Missing technical constraints
- Impossible performance claims
- Security vulnerabilities in design

Respond with ONLY a JSON object:
{
  "passed": boolean,
  "issues": ["specific technical issues"],
  "suggestions": ["how to fix each issue"]
}
`;

      const result = await this.callTerragonValidator(validationPrompt, 'technical');
      return {
        ...result,
        lastChecked: Date.now()
      };
      
    } catch (error) {
      console.error('[DocManager] Technical validation error:', error.message);
      return {
        passed: false,
        issues: [`Technical validation failed: ${error.message}`],
        suggestions: ['Fix validation system connectivity'],
        lastChecked: Date.now()
      };
    }
  }
  
  // Logic validation using Terragon
  async validateLogic(draft) {
    console.log('[DocManager] 🧮 Validating business logic...');
    
    try {
      const validationPrompt = `
You are Uncle Frank's Logic Validator. Analyze this Project.md draft for logical contradictions.

DRAFT CONTENT:
${draft.content}

FRANK'S LOGIC RULES:
1. Business goals must align with features
2. User personas must match user journeys
3. Features must not contradict each other
4. API integrations must serve defined purposes
5. No circular dependencies in logic

Check for:
- Misaligned business goals and features
- Contradictory statements within sections
- Circular logic or dependencies
- Features that don't serve any user persona
- Business logic gaps

Respond with ONLY a JSON object:
{
  "passed": boolean,
  "issues": ["specific logic contradictions"],
  "suggestions": ["how to resolve each contradiction"]
}
`;

      const result = await this.callTerragonValidator(validationPrompt, 'logic');
      return {
        ...result,
        lastChecked: Date.now()
      };
      
    } catch (error) {
      console.error('[DocManager] Logic validation error:', error.message);
      return {
        passed: false,
        issues: [`Logic validation failed: ${error.message}`],
        suggestions: ['Fix validation system connectivity'],
        lastChecked: Date.now()
      };
    }
  }
  
  // Call Terragon for validation (real integration)
  async callTerragonValidator(prompt, validationType) {
    console.log(`[DocManager] 🤖 Running real ${validationType} validation via Terragon`);
    
    const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
    if (!TERRAGON_AUTH) {
      console.warn('[DocManager] TERRAGON_AUTH not configured, falling back to local validation');
      return this.fallbackValidation(prompt, validationType);
    }
    
    try {
      // Create a new Terragon instance for validation
      const payload = [{
        message: {
          type: 'user',
          model: 'sonnet',
          parts: [{
            type: 'rich-text',
            nodes: [{
              type: 'text',
              text: prompt
            }]
          }],
          timestamp: new Date().toISOString()
        },
        githubRepoFullName: 'bhuman-ai/unclefrank-bootstrap',
        repoBaseBranchName: 'master',
        saveAsDraft: false
      }];

      console.log(`[DocManager] 🚀 Creating Terragon validation instance for ${validationType}...`);
      
      const createResponse = await fetch(
        'https://www.terragonlabs.com/dashboard',
        {
          method: 'POST',
          headers: {
            'accept': 'text/x-component',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
            'origin': 'https://www.terragonlabs.com',
            'referer': 'https://www.terragonlabs.com/dashboard',
            'user-agent': 'Mozilla/5.0',
            'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
          },
          body: JSON.stringify(payload)
        }
      );

      const responseText = await createResponse.text();
      const threadIdMatch = responseText.match(/"id":"([^"]+)"/);
      
      if (!threadIdMatch) {
        throw new Error('Failed to create Terragon validation instance');
      }
      
      const threadId = threadIdMatch[1];
      console.log(`[DocManager] ✅ Created Terragon instance: ${threadId}`);
      
      // Wait for response with timeout
      const result = await this.waitForTerragonResponse(threadId, 25000); // 25 second timeout
      
      return this.parseValidationResponse(result, validationType);
      
    } catch (error) {
      console.error(`[DocManager] Terragon ${validationType} validation failed:`, error.message);
      console.log(`[DocManager] 🔄 Falling back to local validation`);
      return this.fallbackValidation(prompt, validationType);
    }
  }
  
  // Wait for Terragon response
  async waitForTerragonResponse(threadId, timeoutMs = 30000) {
    const startTime = Date.now();
    const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
    
    console.log(`[DocManager] ⏳ Waiting for Terragon response from ${threadId}...`);
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(
          `https://www.terragonlabs.com/task/${threadId}`,
          {
            method: 'POST',
            headers: {
              'accept': 'text/x-component',
              'content-type': 'text/plain;charset=UTF-8',
              'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
              'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
              'origin': 'https://www.terragonlabs.com',
              'referer': `https://www.terragonlabs.com/task/${threadId}`,
              'user-agent': 'Mozilla/5.0',
              'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
            },
            body: JSON.stringify([threadId])
          }
        );

        const content = await response.text();
        
        // Extract messages
        const messageMatches = [...content.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)];
        
        if (messageMatches.length > 0) {
          const lastMessage = messageMatches[messageMatches.length - 1][1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"');
          
          // Check if we have a complete JSON response
          if (lastMessage.includes('"passed"') && lastMessage.includes('"issues"')) {
            console.log(`[DocManager] 📨 Received validation response from Terragon`);
            return lastMessage;
          }
        }
        
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[DocManager] Error polling Terragon ${threadId}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Terragon validation timeout');
  }
  
  // Parse validation response from Terragon
  parseValidationResponse(responseText, validationType) {
    try {
      // Extract JSON from response text
      const jsonMatch = responseText.match(/\{[^}]*"passed"[^}]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const validationResult = JSON.parse(jsonMatch[0]);
      
      console.log(`[DocManager] ✅ Parsed ${validationType} validation result:`, {
        passed: validationResult.passed,
        issueCount: validationResult.issues?.length || 0
      });
      
      return {
        passed: !!validationResult.passed,
        issues: validationResult.issues || [],
        suggestions: validationResult.suggestions || []
      };
      
    } catch (error) {
      console.error(`[DocManager] Failed to parse validation response:`, error.message);
      console.log(`[DocManager] Raw response:`, responseText.substring(0, 200));
      
      // Return failed validation if we can't parse
      return {
        passed: false,
        issues: [`Failed to parse ${validationType} validation response`],
        suggestions: ['Check validation system and retry']
      };
    }
  }
  
  // Fallback validation when Terragon is unavailable
  fallbackValidation(prompt, validationType) {
    console.log(`[DocManager] 🔧 Running fallback ${validationType} validation`);
    
    const issues = [];
    const suggestions = [];
    
    if (validationType === 'ux') {
      if (!prompt.includes('User Personas')) {
        issues.push('Missing User Personas section');
        suggestions.push('Add a detailed User Personas & Journeys section');
      }
      if (!prompt.includes('user')) {
        issues.push('No user-focused language detected');
        suggestions.push('Include user value propositions for features');
      }
      if (!prompt.includes('journey')) {
        issues.push('Missing user journey descriptions');
        suggestions.push('Add user journey flows and touchpoints');
      }
    }
    
    if (validationType === 'technical') {
      if (!prompt.includes('API') && !prompt.includes('database')) {
        issues.push('Missing technical architecture details');
        suggestions.push('Add API Integrations & DB Structures section');
      }
      if (!prompt.includes('constraint')) {
        issues.push('Missing technical constraints');
        suggestions.push('Document technical limitations and constraints');
      }
    }
    
    if (validationType === 'logic') {
      const sections = prompt.split('##').length;
      if (sections < 4) {
        issues.push('Insufficient project structure');
        suggestions.push('Include all required Project.md sections');
      }
      if (prompt.includes('contradiction')) {
        issues.push('Potential logical contradictions detected');
        suggestions.push('Review and resolve contradictory statements');
      }
    }
    
    return {
      passed: issues.length === 0,
      issues,
      suggestions
    };
  }
  
  // Determine overall validation status
  determineValidationStatus(validationResults) {
    const uxPassed = validationResults.ux.passed;
    const technicalPassed = validationResults.technical.passed;
    const logicPassed = validationResults.logic.passed;
    
    if (uxPassed && technicalPassed && logicPassed) {
      return 'validated';
    } else {
      return 'validation-failed';
    }
  }
  
  // Get draft by ID
  async getDraft(draftId) {
    try {
      const draftPath = join(this.draftsDir, `${draftId}.json`);
      if (!existsSync(draftPath)) {
        return null;
      }
      
      const draftData = await readFile(draftPath, 'utf-8');
      return JSON.parse(draftData);
    } catch (error) {
      console.error(`[DocManager] Error reading draft ${draftId}:`, error.message);
      return null;
    }
  }
  
  // Save draft
  async saveDraft(draft) {
    const draftPath = join(this.draftsDir, `${draft.draftId}.json`);
    await writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf-8');
  }
  
  // Get draft status
  async getDraftStatus(draftId) {
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    
    return {
      draftId: draft.draftId,
      status: draft.status,
      version: draft.version,
      validationResults: draft.validationResults,
      taskCount: draft.tasks.length,
      createdAt: new Date(draft.createdAt).toISOString(),
      updatedAt: new Date(draft.updatedAt).toISOString(),
      canProceed: draft.status === 'validated',
      nextStep: this.getNextStep(draft.status)
    };
  }
  
  // Get next step based on current status
  getNextStep(status) {
    switch (status) {
      case 'draft':
        return 'validate-draft';
      case 'validating':
        return 'wait-for-validation';
      case 'validation-failed':
        return 'fix-issues-and-revalidate';
      case 'validated':
        return 'create-tasks';
      case 'tasks-created':
        return 'execute-tasks';
      case 'executing':
        return 'wait-for-execution';
      case 'ready-to-merge':
        return 'merge-to-production';
      case 'merged':
        return 'complete';
      default:
        return 'unknown';
    }
  }
  
  // List all drafts
  async listDrafts() {
    try {
      const files = await readdir(this.draftsDir);
      const draftFiles = files.filter(file => file.endsWith('.json'));
      
      const drafts = [];
      for (const file of draftFiles) {
        try {
          const draftPath = join(this.draftsDir, file);
          const draftData = await readFile(draftPath, 'utf-8');
          const draft = JSON.parse(draftData);
          
          // Include summary info only
          drafts.push({
            draftId: draft.draftId,
            status: draft.status,
            version: draft.version,
            metadata: draft.metadata,
            createdAt: new Date(draft.createdAt).toISOString(),
            updatedAt: new Date(draft.updatedAt).toISOString(),
            validationPassed: draft.status === 'validated'
          });
        } catch (error) {
          console.error(`[DocManager] Error reading draft file ${file}:`, error.message);
        }
      }
      
      // Sort by creation date (newest first)
      return drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('[DocManager] Error listing drafts:', error.message);
      return [];
    }
  }
  
  // Create tasks from validated draft
  async createTasksFromDraft(draftId) {
    console.log(`[DocManager] 📋 Creating tasks from validated draft: ${draftId}`);
    
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    
    if (draft.status !== 'validated') {
      throw new Error(`Draft ${draftId} must be validated before creating tasks (current status: ${draft.status})`);
    }
    
    try {
      // Register with task orchestrator for task creation
      const taskCreationResult = await this.registerWithOrchestrator(draft);
      
      // Update draft status
      draft.status = 'tasks-created';
      draft.tasks = taskCreationResult.tasks || [];
      draft.orchestratorInstanceId = taskCreationResult.instanceId;
      draft.updatedAt = Date.now();
      await this.saveDraft(draft);
      
      console.log(`[DocManager] ✅ Tasks created from draft ${draftId}: ${draft.tasks.length} tasks`);
      
      return {
        draftId,
        status: 'tasks-created',
        taskCount: draft.tasks.length,
        orchestratorInstanceId: draft.orchestratorInstanceId
      };
      
    } catch (error) {
      console.error(`[DocManager] ❌ Task creation failed:`, error.message);
      throw new Error(`Failed to create tasks from draft: ${error.message}`);
    }
  }
  
  // Register draft with task orchestrator
  async registerWithOrchestrator(draft) {
    console.log(`[DocManager] 🧠 Registering draft with task orchestrator...`);
    
    try {
      // Create a task orchestrator request
      const orchestratorPayload = {
        action: 'register',
        instanceId: `draft-task-${draft.draftId}`,
        metadata: {
          type: 'main-task',
          parentId: null,
          draftId: draft.draftId,
          checkpoint: null,
          branch: 'master',
          task: {
            name: `Implement ${draft.metadata.title}`,
            description: draft.metadata.description,
            content: draft.content
          }
        }
      };
      
      // Call task orchestrator
      const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/api/task-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orchestratorPayload)
      });
      
      if (!response.ok) {
        throw new Error(`Orchestrator registration failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[DocManager] ✅ Registered with orchestrator: ${result.instanceId}`);
      
      return {
        instanceId: result.instanceId,
        tasks: [] // Tasks will be created by orchestrator decomposition
      };
      
    } catch (error) {
      console.error(`[DocManager] Failed to register with orchestrator:`, error.message);
      // Don't fail completely - we can still track the draft
      return {
        instanceId: null,
        tasks: [],
        error: error.message
      };
    }
  }
  
  // Record branch for draft tracking
  async recordBranchForDraft(draftId, branchName) {
    console.log(`[DocManager] 🌿 Recording branch ${branchName} for draft ${draftId}`);
    
    try {
      const branchPayload = {
        action: 'record',
        threadId: `draft-${draftId}`,
        branchName: branchName
      };
      
      const response = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/api/branch-tracker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(branchPayload)
      });
      
      if (response.ok) {
        console.log(`[DocManager] ✅ Branch recorded for draft tracking`);
      } else {
        console.warn(`[DocManager] ⚠️ Branch tracking failed: ${response.status}`);
      }
      
    } catch (error) {
      console.warn(`[DocManager] Branch tracking error:`, error.message);
      // Don't fail the main operation if branch tracking fails
    }
  }
  
  // Merge validated draft to production Project.md
  async mergeDraft(draftId, humanApproval = false) {
    console.log(`[DocManager] 🔀 Merging draft to production: ${draftId}`);
    
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    
    if (draft.status !== 'validated' && draft.status !== 'ready-to-merge') {
      throw new Error(`Draft ${draftId} is not ready to merge (current status: ${draft.status})`);
    }
    
    if (!humanApproval) {
      throw new Error('Human approval required for merge to production');
    }
    
    try {
      // Backup current Project.md
      const projectPath = join(this.workingDir, 'Project.md');
      const backupPath = join(this.workingDir, 'drafts', `Project-backup-${Date.now()}.md`);
      
      if (existsSync(projectPath)) {
        const currentContent = await readFile(projectPath, 'utf-8');
        await writeFile(backupPath, currentContent, 'utf-8');
        console.log(`[DocManager] 📦 Backed up current Project.md to ${backupPath}`);
      }
      
      // Write new Project.md
      await writeFile(projectPath, draft.content, 'utf-8');
      
      // Record branch for this merge
      await this.recordBranchForDraft(draftId, `terragon/implement-${draft.metadata.title.toLowerCase().replace(/\s+/g, '-')}`);
      
      // Update draft status
      draft.status = 'merged';
      draft.mergedAt = Date.now();
      draft.updatedAt = Date.now();
      await this.saveDraft(draft);
      
      console.log(`[DocManager] ✅ Draft ${draftId} merged to production`);
      
      return {
        draftId,
        status: 'merged',
        mergedAt: new Date(draft.mergedAt).toISOString(),
        backupPath
      };
      
    } catch (error) {
      console.error(`[DocManager] ❌ Merge failed:`, error.message);
      throw new Error(`Failed to merge draft: ${error.message}`);
    }
  }
  
  // Utility: Add timeout to promises
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
      )
    ]);
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
  
  // FRANK'S RATE LIMITING
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  if (!rateLimiter.check(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { action } = req.body;
  
  // Create document manager instance
  const docManager = new DocumentManager();

  try {
    switch (action) {
      case 'create-draft': {
        const { content, metadata } = req.body;
        
        if (!content) {
          return res.status(400).json({ error: 'Draft content is required' });
        }
        
        const draft = await docManager.createDraft(content, metadata);
        
        return res.status(200).json({
          success: true,
          draft: {
            draftId: draft.draftId,
            status: draft.status,
            version: draft.version,
            createdAt: new Date(draft.createdAt).toISOString()
          }
        });
      }
      
      case 'validate-draft': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID is required' });
        }
        
        const validatedDraft = await docManager.validateDraft(draftId);
        
        return res.status(200).json({
          success: true,
          draft: {
            draftId: validatedDraft.draftId,
            status: validatedDraft.status,
            validationResults: validatedDraft.validationResults,
            updatedAt: new Date(validatedDraft.updatedAt).toISOString()
          }
        });
      }
      
      case 'get-draft-status': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID is required' });
        }
        
        const status = await docManager.getDraftStatus(draftId);
        
        return res.status(200).json({
          success: true,
          status
        });
      }
      
      case 'list-drafts': {
        const drafts = await docManager.listDrafts();
        
        return res.status(200).json({
          success: true,
          drafts,
          count: drafts.length
        });
      }
      
      case 'create-tasks': {
        const { draftId } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID is required' });
        }
        
        const taskResult = await docManager.createTasksFromDraft(draftId);
        
        return res.status(200).json({
          success: true,
          tasks: taskResult
        });
      }
      
      case 'merge-draft': {
        const { draftId, humanApproval } = req.body;
        
        if (!draftId) {
          return res.status(400).json({ error: 'Draft ID is required' });
        }
        
        if (!humanApproval) {
          return res.status(400).json({ error: 'Human approval is required for merge' });
        }
        
        const mergeResult = await docManager.mergeDraft(draftId, humanApproval);
        
        return res.status(200).json({
          success: true,
          merge: mergeResult
        });
      }
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[DocManager API] Error:', error.message);
    return res.status(500).json({ 
      error: error.message,
      requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`
    });
  }
}