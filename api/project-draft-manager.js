// PROJECT.MD DRAFT MANAGER - Uncle Frank's Doc-Driven Development System
// Manages Project.md drafts, validation, and the immutable flow

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);

// Constants
const PROJECT_MD_PATH = '/Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/project.md';
const DRAFTS_DIR = '/Users/don/UncleFrank/unclefrank-bootstrap/data/drafts';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'bhuman-ai/unclefrank-bootstrap';

// Draft status states
const DRAFT_STATES = {
    CREATED: 'created',
    VALIDATING: 'validating',
    VALIDATED: 'validated',
    TASK_BREAKDOWN: 'task_breakdown',
    IN_EXECUTION: 'in_execution',
    READY_FOR_MERGE: 'ready_for_merge',
    MERGED: 'merged',
    FAILED: 'failed'
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'create':
                return await createDraft(req, res);
            case 'validate':
                return await validateDraft(req, res);
            case 'get':
                return await getDraft(req, res);
            case 'list':
                return await listDrafts(req, res);
            case 'breakdown':
                return await breakdownToTasks(req, res);
            case 'merge':
                return await mergeDraft(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Project Draft Manager error:', error);
        return res.status(500).json({ 
            error: 'Failed to process request',
            details: error.message 
        });
    }
}

// Create a new Project.md draft
async function createDraft(req, res) {
    const { content, description, author = 'human' } = req.body;
    
    if (!content || !description) {
        return res.status(400).json({ 
            error: 'Missing required fields: content, description' 
        });
    }
    
    // Create draft ID
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const draftPath = path.join(DRAFTS_DIR, draftId);
    
    // Ensure drafts directory exists
    await fs.mkdir(DRAFTS_DIR, { recursive: true });
    await fs.mkdir(draftPath, { recursive: true });
    
    // Save draft content
    const draftData = {
        id: draftId,
        state: DRAFT_STATES.CREATED,
        description,
        author,
        created: new Date().toISOString(),
        content,
        validations: [],
        tasks: [],
        githubIssueNumber: null
    };
    
    await fs.writeFile(
        path.join(draftPath, 'draft.json'),
        JSON.stringify(draftData, null, 2)
    );
    
    await fs.writeFile(
        path.join(draftPath, 'project.md'),
        content
    );
    
    // Create GitHub issue to track this draft
    try {
        const issue = await createGitHubIssue({
            title: `Draft: ${description}`,
            body: `## 📝 Project.md Draft\n\n**ID:** ${draftId}\n**Author:** ${author}\n**Created:** ${draftData.created}\n\n### Description\n${description}\n\n### Status\n- [x] Draft Created\n- [ ] Validation Pending\n- [ ] Task Breakdown Pending\n- [ ] Execution Pending\n- [ ] Ready for Merge\n\n### Tracking\nThis issue tracks the draft through the immutable flow:\nDraft → Validation → Task → Checkpoint → Review → Merge`,
            labels: ['draft', 'project.md', 'uncle-frank']
        });
        
        draftData.githubIssueNumber = issue.number;
        await fs.writeFile(
            path.join(draftPath, 'draft.json'),
            JSON.stringify(draftData, null, 2)
        );
    } catch (error) {
        console.error('Failed to create GitHub issue for draft:', error);
    }
    
    return res.status(200).json({
        success: true,
        draftId,
        state: DRAFT_STATES.CREATED,
        message: 'Project.md draft created successfully',
        githubIssue: draftData.githubIssueNumber
    });
}

// Validate draft against Interface.md and Technical.md
async function validateDraft(req, res) {
    const { draftId } = req.body;
    
    if (!draftId) {
        return res.status(400).json({ error: 'Missing draftId' });
    }
    
    const draftPath = path.join(DRAFTS_DIR, draftId);
    const draftDataPath = path.join(draftPath, 'draft.json');
    
    // Load draft
    const draftData = JSON.parse(await fs.readFile(draftDataPath, 'utf8'));
    const draftContent = await fs.readFile(path.join(draftPath, 'project.md'), 'utf8');
    
    // Load reference documents
    let interfaceContent = '';
    let technicalContent = '';
    try {
        interfaceContent = await fs.readFile('/Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/interface.md', 'utf8');
        technicalContent = await fs.readFile('/Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/technical.md', 'utf8');
    } catch (error) {
        console.error('Failed to load reference docs:', error);
    }
    
    // Update state
    draftData.state = DRAFT_STATES.VALIDATING;
    await fs.writeFile(draftDataPath, JSON.stringify(draftData, null, 2));
    
    // Perform validations
    const validations = [];
    
    // 1. Check for UX consistency (Interface.md)
    const uxValidation = validateUXConsistency(draftContent, interfaceContent);
    validations.push({
        type: 'ux_consistency',
        passed: uxValidation.passed,
        message: uxValidation.message,
        issues: uxValidation.issues,
        timestamp: new Date().toISOString()
    });
    
    // 2. Check for technical coherence (Technical.md)
    const techValidation = validateTechnicalCoherence(draftContent, technicalContent);
    validations.push({
        type: 'technical_coherence',
        passed: techValidation.passed,
        message: techValidation.message,
        issues: techValidation.issues,
        timestamp: new Date().toISOString()
    });
    
    // 3. Check for logical consistency
    const logicValidation = validateLogicalConsistency(draftContent);
    validations.push({
        type: 'logical_consistency',
        passed: logicValidation.passed,
        message: logicValidation.message,
        issues: logicValidation.issues,
        timestamp: new Date().toISOString()
    });
    
    // 4. Check dependency impacts
    const depValidation = validateDependencies(draftContent, technicalContent);
    validations.push({
        type: 'dependency_analysis',
        passed: depValidation.passed,
        message: depValidation.message,
        issues: depValidation.issues,
        timestamp: new Date().toISOString()
    });
    
    // Determine overall validation result
    const allPassed = validations.every(v => v.passed);
    
    // Update draft data
    draftData.validations = validations;
    draftData.state = allPassed ? DRAFT_STATES.VALIDATED : DRAFT_STATES.FAILED;
    draftData.validatedAt = new Date().toISOString();
    
    await fs.writeFile(draftDataPath, JSON.stringify(draftData, null, 2));
    
    // Update GitHub issue
    if (draftData.githubIssueNumber) {
        await updateGitHubIssue(draftData.githubIssueNumber, {
            body: `## 📝 Project.md Draft\n\n**ID:** ${draftId}\n**Status:** ${draftData.state}\n\n### Validation Results\n${validations.map(v => `- [${v.passed ? 'x' : ' '}] ${v.type}: ${v.message}`).join('\n')}\n\n### Progress\n- [x] Draft Created\n- [x] Validation ${allPassed ? 'Passed ✅' : 'Failed ❌'}\n- [ ] Task Breakdown Pending\n- [ ] Execution Pending\n- [ ] Ready for Merge`
        });
    }
    
    return res.status(200).json({
        success: true,
        draftId,
        state: draftData.state,
        validations,
        allPassed,
        message: allPassed ? 
            'Draft validation passed - ready for task breakdown' : 
            'Draft validation failed - fix issues and retry'
    });
}

// Break down draft into tasks
async function breakdownToTasks(req, res) {
    const { draftId } = req.body;
    
    if (!draftId) {
        return res.status(400).json({ error: 'Missing draftId' });
    }
    
    const draftPath = path.join(DRAFTS_DIR, draftId);
    const draftDataPath = path.join(draftPath, 'draft.json');
    
    // Load draft
    const draftData = JSON.parse(await fs.readFile(draftDataPath, 'utf8'));
    const draftContent = await fs.readFile(path.join(draftPath, 'project.md'), 'utf8');
    
    // Check if validated
    if (draftData.state !== DRAFT_STATES.VALIDATED) {
        return res.status(400).json({ 
            error: 'Draft must be validated before task breakdown' 
        });
    }
    
    // Update state
    draftData.state = DRAFT_STATES.TASK_BREAKDOWN;
    
    // Use System Agent to generate tasks
    const tasks = await generateTasksFromDraft(draftContent, draftData.description);
    
    // Create GitHub issues for each task
    for (const task of tasks) {
        try {
            const issue = await createGitHubIssue({
                title: `Task: ${task.name}`,
                body: `## 📋 Task Details\n\n**Draft ID:** ${draftId}\n**Task ID:** ${task.id}\n\n### Objective\n${task.objective}\n\n### Acceptance Criteria\n${task.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}\n\n### Status\n**Current:** ${task.status}\n\n### Tracking\nThis task is part of Draft ${draftId}`,
                labels: ['task', 'claude', 'draft-task']
            });
            
            task.githubIssueNumber = issue.number;
        } catch (error) {
            console.error('Failed to create GitHub issue for task:', error);
        }
    }
    
    // Update draft data
    draftData.tasks = tasks;
    draftData.taskBreakdownAt = new Date().toISOString();
    
    await fs.writeFile(draftDataPath, JSON.stringify(draftData, null, 2));
    
    return res.status(200).json({
        success: true,
        draftId,
        state: draftData.state,
        tasks: tasks.map(t => ({
            id: t.id,
            name: t.name,
            githubIssue: t.githubIssueNumber
        })),
        message: `Draft broken down into ${tasks.length} tasks`
    });
}

// Get draft details
async function getDraft(req, res) {
    const { draftId } = req.query;
    
    if (!draftId) {
        return res.status(400).json({ error: 'Missing draftId' });
    }
    
    const draftPath = path.join(DRAFTS_DIR, draftId);
    const draftDataPath = path.join(draftPath, 'draft.json');
    
    try {
        const draftData = JSON.parse(await fs.readFile(draftDataPath, 'utf8'));
        const content = await fs.readFile(path.join(draftPath, 'project.md'), 'utf8');
        
        return res.status(200).json({
            ...draftData,
            content
        });
    } catch (error) {
        return res.status(404).json({ error: 'Draft not found' });
    }
}

// List all drafts
async function listDrafts(req, res) {
    try {
        await fs.mkdir(DRAFTS_DIR, { recursive: true });
        const drafts = await fs.readdir(DRAFTS_DIR);
        
        const draftList = [];
        for (const draftId of drafts) {
            try {
                const draftData = JSON.parse(
                    await fs.readFile(
                        path.join(DRAFTS_DIR, draftId, 'draft.json'),
                        'utf8'
                    )
                );
                draftList.push({
                    id: draftData.id,
                    description: draftData.description,
                    state: draftData.state,
                    created: draftData.created,
                    author: draftData.author,
                    githubIssue: draftData.githubIssueNumber
                });
            } catch (error) {
                console.error(`Failed to load draft ${draftId}:`, error);
            }
        }
        
        return res.status(200).json({
            drafts: draftList,
            total: draftList.length
        });
    } catch (error) {
        return res.status(500).json({ 
            error: 'Failed to list drafts',
            details: error.message 
        });
    }
}

// Merge draft to production Project.md
async function mergeDraft(req, res) {
    const { draftId } = req.body;
    
    if (!draftId) {
        return res.status(400).json({ error: 'Missing draftId' });
    }
    
    const draftPath = path.join(DRAFTS_DIR, draftId);
    const draftDataPath = path.join(draftPath, 'draft.json');
    
    // Load draft
    const draftData = JSON.parse(await fs.readFile(draftDataPath, 'utf8'));
    
    // Check if all tasks are complete
    const allTasksComplete = draftData.tasks.every(t => t.status === 'completed');
    
    if (!allTasksComplete) {
        return res.status(400).json({ 
            error: 'Cannot merge - not all tasks are completed' 
        });
    }
    
    // Load draft content
    const draftContent = await fs.readFile(path.join(draftPath, 'project.md'), 'utf8');
    
    // Backup current Project.md
    const currentContent = await fs.readFile(PROJECT_MD_PATH, 'utf8');
    await fs.writeFile(
        path.join(draftPath, 'project.md.backup'),
        currentContent
    );
    
    // Merge to production
    await fs.writeFile(PROJECT_MD_PATH, draftContent);
    
    // Update draft state
    draftData.state = DRAFT_STATES.MERGED;
    draftData.mergedAt = new Date().toISOString();
    
    await fs.writeFile(draftDataPath, JSON.stringify(draftData, null, 2));
    
    // Close GitHub issue
    if (draftData.githubIssueNumber) {
        await updateGitHubIssue(draftData.githubIssueNumber, {
            state: 'closed',
            body: `## ✅ Draft Merged to Production\n\n**Merged at:** ${draftData.mergedAt}\n\nAll tasks completed and validated. Project.md has been updated.`
        });
    }
    
    return res.status(200).json({
        success: true,
        draftId,
        state: DRAFT_STATES.MERGED,
        message: 'Draft successfully merged to production Project.md'
    });
}

// Validation Helper: Check UX Consistency
function validateUXConsistency(draftContent, interfaceContent) {
    const issues = [];
    
    // Check if draft references UI components that don't exist in Interface.md
    const uiComponents = ['Dashboard', 'Workspace', 'Panel', 'Button', 'Modal', 'Form'];
    for (const component of uiComponents) {
        if (draftContent.includes(component) && !interfaceContent.includes(component)) {
            issues.push(`References ${component} but not defined in Interface.md`);
        }
    }
    
    // Check for screen structure consistency
    if (draftContent.includes('Screen') || draftContent.includes('View')) {
        const draftScreens = draftContent.match(/(\w+)\s+(Screen|View)/gi) || [];
        const interfaceScreens = interfaceContent.match(/(\w+)\s+(Screen|View)/gi) || [];
        
        for (const screen of draftScreens) {
            if (!interfaceScreens.some(s => s.toLowerCase() === screen.toLowerCase())) {
                issues.push(`New screen "${screen}" not documented in Interface.md`);
            }
        }
    }
    
    return {
        passed: issues.length === 0,
        message: issues.length === 0 ? 
            'UX references are consistent with Interface.md' : 
            `Found ${issues.length} UX inconsistencies`,
        issues
    };
}

// Validation Helper: Check Technical Coherence
function validateTechnicalCoherence(draftContent, technicalContent) {
    const issues = [];
    
    // Check API endpoint references
    const apiPattern = /\/api\/[\w-]+/g;
    const draftAPIs = draftContent.match(apiPattern) || [];
    const techAPIs = technicalContent.match(apiPattern) || [];
    
    for (const api of draftAPIs) {
        if (!techAPIs.includes(api) && !api.includes('new')) {
            issues.push(`API endpoint ${api} not documented in Technical.md`);
        }
    }
    
    // Check agent references
    const agentPattern = /(\w+)[-\s]?[Aa]gent/g;
    const draftAgents = draftContent.match(agentPattern) || [];
    
    for (const agent of draftAgents) {
        if (!technicalContent.includes(agent)) {
            issues.push(`Agent "${agent}" not defined in Technical.md`);
        }
    }
    
    // Check infrastructure references
    if (draftContent.includes('Fly.io') && !technicalContent.includes('Fly.io')) {
        issues.push('References Fly.io but not in technical architecture');
    }
    if (draftContent.includes('Vercel') && !technicalContent.includes('Vercel')) {
        issues.push('References Vercel but not in technical architecture');
    }
    
    return {
        passed: issues.length === 0,
        message: issues.length === 0 ? 
            'Technical references align with Technical.md' : 
            `Found ${issues.length} technical inconsistencies`,
        issues
    };
}

// Validation Helper: Check Logical Consistency
function validateLogicalConsistency(draftContent) {
    const issues = [];
    
    // Check for contradictory statements
    const contradictions = [
        { terms: ['automated', 'manual'], context: 'same feature' },
        { terms: ['synchronous', 'asynchronous'], context: 'same operation' },
        { terms: ['required', 'optional'], context: 'same field' }
    ];
    
    for (const contradiction of contradictions) {
        const lines = draftContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            if (contradiction.terms.every(term => line.includes(term))) {
                issues.push(`Line ${i + 1}: Contradictory terms "${contradiction.terms.join('" and "')}" in same context`);
            }
        }
    }
    
    // Check for incomplete specifications
    if (draftContent.includes('TODO') || draftContent.includes('TBD')) {
        issues.push('Contains incomplete specifications (TODO/TBD)');
    }
    
    // Check for vague requirements
    const vagueTerms = ['maybe', 'possibly', 'might', 'could be', 'should probably'];
    for (const term of vagueTerms) {
        if (draftContent.toLowerCase().includes(term)) {
            issues.push(`Contains vague requirement with "${term}" - be specific`);
        }
    }
    
    return {
        passed: issues.length === 0,
        message: issues.length === 0 ? 
            'No logical contradictions found' : 
            `Found ${issues.length} logical issues`,
        issues
    };
}

// Validation Helper: Check Dependencies
function validateDependencies(draftContent, technicalContent) {
    const issues = [];
    
    // Check for breaking changes
    const breakingIndicators = [
        'BREAKING:', 'Breaking Change', 'removes', 'deprecates', 'replaces'
    ];
    
    for (const indicator of breakingIndicators) {
        if (draftContent.includes(indicator)) {
            const lines = draftContent.split('\n');
            const breakingLines = lines.filter(l => l.includes(indicator));
            for (const line of breakingLines) {
                issues.push(`Breaking change detected: "${line.trim()}"`);
            }
        }
    }
    
    // Check for new dependencies not in technical spec
    const dependencyPattern = /requires?\s+(\w+)/gi;
    const matches = draftContent.match(dependencyPattern) || [];
    
    for (const match of matches) {
        const dep = match.replace(/requires?\s+/i, '');
        if (!technicalContent.includes(dep)) {
            issues.push(`New dependency "${dep}" not in technical architecture`);
        }
    }
    
    // Check task ordering requirements
    if (draftContent.includes('must be done before') || draftContent.includes('depends on')) {
        const lines = draftContent.split('\n').filter(l => 
            l.includes('must be done before') || l.includes('depends on')
        );
        for (const line of lines) {
            issues.push(`Dependency constraint: "${line.trim()}"`);
        }
    }
    
    return {
        passed: issues.filter(i => i.startsWith('Breaking')).length === 0,
        message: issues.length === 0 ? 
            'No problematic dependencies detected' : 
            `Found ${issues.length} dependency concerns`,
        issues
    };
}

// Generate tasks from draft using Claude
async function generateTasksFromDraft(draftContent, description) {
    console.log('[Draft Manager] Generating tasks from draft using Claude...');
    
    try {
        // Call Claude executor to analyze draft and create tasks
        const response = await fetch('https://uncle-frank-claude.fly.dev/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskTitle: `Generate Tasks from Draft: ${description}`,
                taskDescription: `Analyze this Project.md draft and break it down into concrete implementation tasks:

# Draft Description
${description}

# Draft Content
${draftContent}

# INSTRUCTIONS
Analyze the draft changes and create 3-5 concrete implementation tasks.
Each task should be:
- Specific and actionable
- Independently executable
- Have clear acceptance criteria
- Ordered by dependency

Return tasks in this format:

## Task 1: [Name]
**Objective:** [Clear goal in one sentence]
**Acceptance Criteria:**
- [Specific criterion 1]
- [Specific criterion 2]
- [Specific criterion 3]
**Priority:** [high/medium/low]
**Dependencies:** [none or list task numbers]

## Task 2: [Name]
[same format]

Focus on what needs to be BUILT or CHANGED, not documentation or planning.`
            })
        });

        if (!response.ok) {
            throw new Error('Failed to connect to Claude');
        }

        const session = await response.json();
        console.log(`[Draft Manager] Claude session created: ${session.sessionId}`);

        // Execute the task generation
        const executeResponse = await fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${session.sessionId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Generate the tasks based on the draft.'
            })
        });

        if (!executeResponse.ok) {
            throw new Error('Failed to execute task generation');
        }

        // Poll for completion
        let tasks = [];
        let pollAttempts = 0;
        const maxPollAttempts = 30; // 60 seconds max
        
        while (pollAttempts < maxPollAttempts) {
            pollAttempts++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            const statusResponse = await fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${session.sessionId}/status`);
            
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                
                if (statusData.status === 'completed' && statusData.lastResponse) {
                    const claudeResponse = typeof statusData.lastResponse === 'string' 
                        ? statusData.lastResponse 
                        : statusData.lastResponse.content;
                    
                    // Parse tasks from Claude's response
                    tasks = parseTasksFromResponse(claudeResponse);
                    console.log(`[Draft Manager] Generated ${tasks.length} tasks from Claude`);
                    break;
                }
            }
        }

        // If Claude didn't generate tasks or timed out, use fallback
        if (tasks.length === 0) {
            console.warn('[Draft Manager] Using fallback task generation');
            tasks = generateFallbackTasks(draftContent, description);
        }

        return tasks;
    } catch (error) {
        console.error('[Draft Manager] Error generating tasks with Claude:', error);
        // Use fallback task generation
        return generateFallbackTasks(draftContent, description);
    }
}

// Parse tasks from Claude's response
function parseTasksFromResponse(response) {
    const tasks = [];
    const sections = response.split(/##\s*Task\s*\d+:/i);
    
    for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const lines = section.split('\n');
        
        const task = {
            id: `task-${Date.now()}-${i}`,
            name: lines[0].trim(),
            objective: '',
            acceptanceCriteria: [],
            priority: 'medium',
            dependencies: [],
            status: 'pending'
        };
        
        let currentField = null;
        
        for (const line of lines) {
            if (line.match(/^\*?\*?Objective:/i)) {
                task.objective = line.replace(/^\*?\*?Objective:\*?\*?\s*/i, '').trim();
                currentField = 'objective';
            } else if (line.match(/^\*?\*?Acceptance Criteria:/i)) {
                currentField = 'criteria';
            } else if (line.match(/^\*?\*?Priority:/i)) {
                task.priority = line.replace(/^\*?\*?Priority:\*?\*?\s*/i, '').toLowerCase().trim();
                currentField = 'priority';
            } else if (line.match(/^\*?\*?Dependencies:/i)) {
                const deps = line.replace(/^\*?\*?Dependencies:\*?\*?\s*/i, '').trim();
                if (deps && deps.toLowerCase() !== 'none') {
                    task.dependencies = deps.split(',').map(d => d.trim());
                }
                currentField = 'dependencies';
            } else if (currentField === 'criteria' && line.trim().startsWith('-')) {
                task.acceptanceCriteria.push(line.replace(/^-\s*/, '').trim());
            }
        }
        
        if (task.name && task.objective) {
            tasks.push(task);
        }
    }
    
    return tasks;
}

// Generate fallback tasks when Claude is unavailable
function generateFallbackTasks(draftContent, description) {
    console.log('[Draft Manager] Using fallback task generation');
    
    // Analyze the draft to identify changes
    const hasAPI = draftContent.includes('/api/') || draftContent.includes('endpoint');
    const hasUI = draftContent.includes('interface') || draftContent.includes('component') || draftContent.includes('screen');
    const hasData = draftContent.includes('database') || draftContent.includes('schema') || draftContent.includes('model');
    
    const tasks = [];
    let taskIndex = 1;
    
    // Create tasks based on detected changes
    if (hasData) {
        tasks.push({
            id: `task-${Date.now()}-${taskIndex++}`,
            name: 'Database and Data Model Updates',
            objective: 'Update database schema and data models based on draft requirements',
            acceptanceCriteria: [
                'Database schema updated',
                'Models reflect new structure',
                'Migrations created and tested'
            ],
            priority: 'high',
            dependencies: [],
            status: 'pending'
        });
    }
    
    if (hasAPI) {
        tasks.push({
            id: `task-${Date.now()}-${taskIndex++}`,
            name: 'API Implementation',
            objective: 'Implement API endpoints and business logic',
            acceptanceCriteria: [
                'API endpoints created and functional',
                'Request validation implemented',
                'Response formats match specification'
            ],
            priority: 'high',
            dependencies: hasData ? ['Database and Data Model Updates'] : [],
            status: 'pending'
        });
    }
    
    if (hasUI) {
        tasks.push({
            id: `task-${Date.now()}-${taskIndex++}`,
            name: 'UI Component Development',
            objective: 'Build user interface components and screens',
            acceptanceCriteria: [
                'UI components created and styled',
                'User interactions functional',
                'Responsive design implemented'
            ],
            priority: 'medium',
            dependencies: hasAPI ? ['API Implementation'] : [],
            status: 'pending'
        });
    }
    
    // Always add testing task
    tasks.push({
        id: `task-${Date.now()}-${taskIndex++}`,
        name: 'Testing and Validation',
        objective: 'Test all changes and ensure quality',
        acceptanceCriteria: [
            'Unit tests written and passing',
            'Integration tests completed',
            'Manual testing performed'
        ],
        priority: 'medium',
        dependencies: tasks.map(t => t.name),
        status: 'pending'
    });
    
    // Add documentation task if significant changes
    if (tasks.length > 2) {
        tasks.push({
            id: `task-${Date.now()}-${taskIndex++}`,
            name: 'Documentation Updates',
            objective: 'Update documentation to reflect changes',
            acceptanceCriteria: [
                'README updated',
                'API documentation current',
                'Code comments added'
            ],
            priority: 'low',
            dependencies: ['Testing and Validation'],
            status: 'pending'
        });
    }
    
    return tasks;
}

// Helper: Create GitHub issue
async function createGitHubIssue({ title, body, labels }) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ title, body, labels });
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/issues`,
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'UncleFrank-DraftManager',
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const issue = JSON.parse(responseData);
                    if (res.statusCode === 201) {
                        resolve(issue);
                    } else {
                        reject(new Error(`GitHub API error: ${issue.message}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Helper: Update GitHub issue
async function updateGitHubIssue(issueNumber, updates) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(updates);
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/issues/${issueNumber}`,
            method: 'PATCH',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'UncleFrank-DraftManager',
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(responseData));
                } else {
                    reject(new Error(`Failed to update issue: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}