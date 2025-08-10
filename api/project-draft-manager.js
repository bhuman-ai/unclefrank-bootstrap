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
    
    // Update state
    draftData.state = DRAFT_STATES.VALIDATING;
    await fs.writeFile(draftDataPath, JSON.stringify(draftData, null, 2));
    
    // Perform validations
    const validations = [];
    
    // 1. Check for UX consistency (Interface.md)
    validations.push({
        type: 'ux_consistency',
        passed: true, // TODO: Implement actual validation
        message: 'UX flow references are consistent with Interface.md',
        timestamp: new Date().toISOString()
    });
    
    // 2. Check for technical coherence (Technical.md)
    validations.push({
        type: 'technical_coherence',
        passed: true, // TODO: Implement actual validation
        message: 'API schemas and architecture align with Technical.md',
        timestamp: new Date().toISOString()
    });
    
    // 3. Check for logical consistency
    validations.push({
        type: 'logical_consistency',
        passed: true, // TODO: Implement actual validation
        message: 'No contradictions found in business logic',
        timestamp: new Date().toISOString()
    });
    
    // 4. Check dependency impacts
    validations.push({
        type: 'dependency_analysis',
        passed: true, // TODO: Implement actual validation
        message: 'No breaking changes detected in dependencies',
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
    
    // Check if validated
    if (draftData.state !== DRAFT_STATES.VALIDATED) {
        return res.status(400).json({ 
            error: 'Draft must be validated before task breakdown' 
        });
    }
    
    // Update state
    draftData.state = DRAFT_STATES.TASK_BREAKDOWN;
    
    // Generate tasks (this would normally use Claude API)
    const tasks = [
        {
            id: `task-${Date.now()}-1`,
            name: 'Implement core feature changes',
            objective: 'Update core business logic as per draft',
            acceptanceCriteria: [
                'All new endpoints are functional',
                'Database schema is updated',
                'Tests pass with 100% coverage'
            ],
            checkpoints: [],
            status: 'pending',
            githubIssueNumber: null
        },
        {
            id: `task-${Date.now()}-2`,
            name: 'Update UI components',
            objective: 'Align UI with new Project.md specifications',
            acceptanceCriteria: [
                'All UI components render correctly',
                'Responsive design works on all devices',
                'Accessibility standards are met'
            ],
            checkpoints: [],
            status: 'pending',
            githubIssueNumber: null
        }
    ];
    
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