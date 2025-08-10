// FRANK - THE DOC-DRIVEN DEVELOPMENT ASSISTANT
// No-nonsense workflow orchestrator with Brooklyn attitude

import fs from 'fs/promises';
import path from 'path';

const DRAFTS_DIR = '/Users/don/UncleFrank/unclefrank-bootstrap/data/drafts';
const PROJECT_MD_PATH = '/Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/project.md';
const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'POST requests only, pal.',
            frank: 'I don\'t do GET requests.' 
        });
    }
    
    const { message, context = {} } = req.body;
    
    if (!message) {
        return res.status(400).json({
            error: 'Missing message',
            frank: 'You gotta tell me what you want. I\'m not a mind reader.'
        });
    }
    
    try {
        // Analyze the message intent
        const intent = analyzeIntent(message);
        
        switch (intent.action) {
            case 'create_draft':
                return await handleCreateDraft(intent, context, res);
                
            case 'validate':
                return await handleValidate(context, res);
                
            case 'breakdown':
                return await handleBreakdown(context, res);
                
            case 'status':
                return await handleStatus(context, res);
                
            case 'execute':
                return await handleExecute(intent, context, res);
                
            case 'merge':
                return await handleMerge(context, res);
                
            case 'explain':
                return await handleExplain(intent, res);
                
            default:
                return await handleGeneralQuery(message, context, res);
        }
    } catch (error) {
        console.error('[Frank] Error:', error);
        return res.status(500).json({
            error: 'Something went wrong',
            frank: `Look, something broke: ${error.message}. Try again or fix your setup.`,
            details: error.message
        });
    }
}

// Analyze user intent from message
function analyzeIntent(message) {
    const msg = message.toLowerCase();
    
    if (msg.includes('create') && (msg.includes('draft') || msg.includes('change'))) {
        return {
            action: 'create_draft',
            description: extractDescription(message)
        };
    }
    
    if (msg.includes('validate') || msg.includes('check')) {
        return { action: 'validate' };
    }
    
    if (msg.includes('task') || msg.includes('break') || msg.includes('decompose')) {
        return { action: 'breakdown' };
    }
    
    if (msg.includes('status') || msg.includes('progress') || msg.includes('where are we')) {
        return { action: 'status' };
    }
    
    if (msg.includes('execute') || msg.includes('run') || msg.includes('do it')) {
        return { action: 'execute' };
    }
    
    if (msg.includes('merge') || msg.includes('production') || msg.includes('deploy')) {
        return { action: 'merge' };
    }
    
    if (msg.includes('explain') || msg.includes('what is') || msg.includes('how does')) {
        return {
            action: 'explain',
            topic: extractTopic(message)
        };
    }
    
    return { action: 'general' };
}

// Extract description from message
function extractDescription(message) {
    // Remove common prefixes
    let desc = message
        .replace(/^(create|make|build|add|implement|update|change)\s+(a\s+)?draft\s+(for|to|that)?\s*/i, '')
        .replace(/^i\s+want\s+to\s+/i, '')
        .replace(/^let\'?s\s+/i, '');
    
    return desc.trim() || 'User-requested changes';
}

// Extract topic from message
function extractTopic(message) {
    const topic = message
        .replace(/^(explain|what\s+is|how\s+does|tell\s+me\s+about)\s+/i, '')
        .replace(/\?$/, '')
        .trim();
    
    return topic || 'the system';
}

// Handle draft creation
async function handleCreateDraft(intent, context, res) {
    const description = intent.description || 'User requested changes';
    
    // Load current Project.md
    let currentContent = '';
    try {
        currentContent = await fs.readFile(PROJECT_MD_PATH, 'utf8');
    } catch (error) {
        console.error('[Frank] Could not read Project.md:', error);
        currentContent = '# Project.md\n\n[New draft - no existing content]';
    }
    
    // Call draft manager to create draft
    const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/project-draft-manager?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: currentContent,
            description: description,
            author: 'frank'
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        return res.status(200).json({
            success: true,
            response: `Alright, created draft ${result.draftId}. GitHub issue #${result.githubIssue || 'pending'} is tracking this.

Next steps:
1. Edit the draft in the Draft tab
2. Validate it when you're done
3. Break it down to tasks
4. Execute the tasks
5. Merge to production

No shortcuts, that's the flow.`,
            draftId: result.draftId,
            githubIssue: result.githubIssue,
            action: 'draft_created'
        });
    } else {
        return res.status(500).json({
            success: false,
            response: `Failed to create draft: ${result.error}. Fix your setup.`,
            error: result.error
        });
    }
}

// Handle validation
async function handleValidate(context, res) {
    if (!context.draftId) {
        return res.status(400).json({
            success: false,
            response: 'No draft to validate. Create one first, genius.',
            needsDraft: true
        });
    }
    
    const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/project-draft-manager?action=validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            draftId: context.draftId
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        const failedValidations = result.validations.filter(v => !v.passed);
        
        if (result.allPassed) {
            return res.status(200).json({
                success: true,
                response: `✅ All validations passed. Clean as a whistle.

Ready to break this down into tasks. Just say the word.`,
                validations: result.validations,
                action: 'validation_passed'
            });
        } else {
            return res.status(200).json({
                success: false,
                response: `❌ Validation failed. ${failedValidations.length} issues found:

${failedValidations.map(v => `- ${v.type}: ${v.message}`).join('\n')}

Fix these issues in the draft, then validate again. No half-assed work here.`,
                validations: result.validations,
                action: 'validation_failed'
            });
        }
    } else {
        return res.status(500).json({
            success: false,
            response: `Validation blew up: ${result.error}`,
            error: result.error
        });
    }
}

// Handle task breakdown
async function handleBreakdown(context, res) {
    if (!context.draftId) {
        return res.status(400).json({
            success: false,
            response: 'No draft to break down. Create and validate one first.',
            needsDraft: true
        });
    }
    
    const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/project-draft-manager?action=breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            draftId: context.draftId
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        return res.status(200).json({
            success: true,
            response: `Created ${result.tasks.length} tasks. Each one's got a GitHub issue.

Tasks:
${result.tasks.map((t, i) => `${i + 1}. ${t.name} (Issue #${t.githubIssue || 'pending'})`).join('\n')}

These are ready to execute. Say "execute" when you want Claude to start working.`,
            tasks: result.tasks,
            action: 'tasks_created'
        });
    } else {
        return res.status(500).json({
            success: false,
            response: `Task breakdown failed: ${result.error}`,
            error: result.error
        });
    }
}

// Handle status check
async function handleStatus(context, res) {
    let statusReport = 'Current Workflow Status:\n\n';
    
    if (context.draftId) {
        // Get draft details
        const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/project-draft-manager?action=get&draftId=${context.draftId}`);
        
        if (response.ok) {
            const draft = await response.json();
            
            statusReport += `📝 Draft: ${draft.id}\n`;
            statusReport += `   State: ${draft.state}\n`;
            statusReport += `   GitHub Issue: #${draft.githubIssueNumber || 'none'}\n\n`;
            
            if (draft.validations && draft.validations.length > 0) {
                const passed = draft.validations.filter(v => v.passed).length;
                statusReport += `✅ Validation: ${passed}/${draft.validations.length} passed\n\n`;
            } else {
                statusReport += `○ Validation: Not run yet\n\n`;
            }
            
            if (draft.tasks && draft.tasks.length > 0) {
                const completed = draft.tasks.filter(t => t.status === 'completed').length;
                statusReport += `📋 Tasks: ${completed}/${draft.tasks.length} completed\n`;
                
                for (const task of draft.tasks) {
                    statusReport += `   - ${task.name}: ${task.status}\n`;
                }
            } else {
                statusReport += `○ Tasks: Not created yet\n`;
            }
        }
    } else {
        statusReport += `No active draft. Start by creating one.\n\n`;
        statusReport += `The flow:\n`;
        statusReport += `1. Create a draft with your changes\n`;
        statusReport += `2. Validate against Interface.md and Technical.md\n`;
        statusReport += `3. Break down to tasks\n`;
        statusReport += `4. Execute checkpoints\n`;
        statusReport += `5. Review and merge\n`;
    }
    
    return res.status(200).json({
        success: true,
        response: statusReport,
        action: 'status_report'
    });
}

// Handle task execution
async function handleExecute(intent, context, res) {
    if (!context.tasks || context.tasks.length === 0) {
        return res.status(400).json({
            success: false,
            response: 'No tasks to execute. Create a draft, validate it, and break it down first.',
            needsTasks: true
        });
    }
    
    // Find next pending task
    const nextTask = context.tasks.find(t => t.status === 'pending');
    
    if (!nextTask) {
        return res.status(200).json({
            success: true,
            response: 'All tasks are complete. Ready to merge to production.',
            action: 'all_complete'
        });
    }
    
    // Execute task with Claude
    const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/claude-executor-integration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'create-task',
            payload: {
                message: `Execute Task: ${nextTask.name}\n\nObjective: ${nextTask.objective}\n\nAcceptance Criteria:\n${nextTask.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`,
                issueNumber: nextTask.githubIssueNumber
            }
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        return res.status(200).json({
            success: true,
            response: `Executing task: ${nextTask.name}

Claude is working on branch: ${result.branch}
GitHub: ${result.githubUrl}

This will take a minute. I'll update the task status when it's done.`,
            threadId: result.threadId,
            branch: result.branch,
            action: 'task_executing'
        });
    } else {
        return res.status(500).json({
            success: false,
            response: `Failed to execute task: ${result.error}`,
            error: result.error
        });
    }
}

// Handle merge to production
async function handleMerge(context, res) {
    if (!context.draftId) {
        return res.status(400).json({
            success: false,
            response: 'No draft to merge. What are you trying to pull here?',
            needsDraft: true
        });
    }
    
    const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/project-draft-manager?action=merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            draftId: context.draftId
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        return res.status(200).json({
            success: true,
            response: `✅ Draft merged to production Project.md.

The changes are live. GitHub issue closed.

Ready for the next draft when you are.`,
            action: 'merged'
        });
    } else {
        return res.status(500).json({
            success: false,
            response: `Can't merge: ${result.error}

Probably not all tasks are done. Check the status.`,
            error: result.error
        });
    }
}

// Handle explanations
async function handleExplain(intent, res) {
    const topic = intent.topic.toLowerCase();
    
    const explanations = {
        'draft': `A draft is a proposed change to Project.md. It's the starting point for any modification to the system. You create it, validate it, break it down, execute it, then merge it. That's the immutable flow.`,
        
        'validation': `Validation checks your draft against Interface.md (UI consistency) and Technical.md (technical coherence). Also checks for logical contradictions and dependency issues. If it doesn't pass, you can't proceed.`,
        
        'checkpoints': `Checkpoints are micro-steps with binary pass/fail tests. Each task gets broken down into checkpoints. They execute in order, can retry on failure, and escalate if they keep failing. Currently, they're more theory than practice.`,
        
        'the flow': `The immutable flow: Draft → Validation → Task → Checkpoint → Review → Merge. No shortcuts, no bypasses. Every change follows this path. It's in Claude.md, our constitution.`,
        
        'frank': `That's me. I manage the doc-driven development flow. No BS, just structured execution. I make sure you follow the process and don't cut corners.`,
        
        'project.md': `The single source of truth for what we're building. Production state. Only gets updated through the immutable flow. Lives in "docs to work towards" folder.`,
        
        'claude.md': `Our development constitution. Defines the immutable principles and workflows. How we work, not what we build. Can only be edited by humans.`,
        
        'interface.md': `UI specification. Defines all screens, components, and user interactions. Drafts get validated against this for UX consistency.`,
        
        'technical.md': `System architecture and technical specs. APIs, agents, infrastructure. Drafts get validated against this for technical coherence.`
    };
    
    const explanation = explanations[topic] || `I don't have a canned explanation for "${topic}". Be more specific or check the docs.`;
    
    return res.status(200).json({
        success: true,
        response: explanation,
        action: 'explanation'
    });
}

// Handle general queries
async function handleGeneralQuery(message, context, res) {
    // For general queries, provide guidance based on context
    let response = '';
    
    if (!context.draftId) {
        response = `Looks like you're trying to chat. I'm not here for small talk.

You want to make changes? Create a draft.
Need to know where things stand? Ask for status.
Want something explained? Ask specifically.

Otherwise, follow the flow: Draft → Validation → Task → Checkpoint → Review → Merge.`;
    } else {
        response = `You have an active draft. Here's what you can do:
- "validate" - Check the draft
- "breakdown" - Create tasks
- "execute" - Run the tasks
- "status" - See where we are
- "merge" - Push to production (when ready)

What's it gonna be?`;
    }
    
    return res.status(200).json({
        success: true,
        response: response,
        action: 'general_response'
    });
}