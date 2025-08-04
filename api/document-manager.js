import { simpleGit } from 'simple-git';

// State interface for drafts
const drafts = new Map();

// Initialize git instance
const git = simpleGit();

// Basic error handling wrapper
function withErrorHandling(fn, operation = 'operation') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            console.error(`Document Manager Error [${operation}]:`, error.message);
            throw new Error(`Failed to execute ${operation}: ${error.message}`);
        }
    };
}

// Core document manager functions
export const DocumentManager = {
    // Draft management
    createDraft: withErrorHandling(async (id, content) => {
        drafts.set(id, {
            id,
            content,
            created: new Date(),
            modified: new Date()
        });
        return drafts.get(id);
    }, 'createDraft'),

    getDraft: withErrorHandling(async (id) => {
        return drafts.get(id);
    }, 'getDraft'),

    updateDraft: withErrorHandling(async (id, content) => {
        if (!drafts.has(id)) {
            throw new Error(`Draft ${id} not found`);
        }
        const draft = drafts.get(id);
        draft.content = content;
        draft.modified = new Date();
        return draft;
    }, 'updateDraft'),

    deleteDraft: withErrorHandling(async (id) => {
        return drafts.delete(id);
    }, 'deleteDraft'),

    listDrafts: withErrorHandling(async () => {
        return Array.from(drafts.values());
    }, 'listDrafts'),

    // Git integration hooks
    onCommit: withErrorHandling(async (callback) => {
        // Setup git hook for commits
        const status = await git.status();
        if (callback && typeof callback === 'function') {
            await callback(status);
        }
        return status;
    }, 'onCommit'),

    getGitStatus: withErrorHandling(async () => {
        return await git.status();
    }, 'getGitStatus'),

    testCommit: withErrorHandling(async (message = 'Test commit from document manager') => {
        // Test git hook functionality
        const status = await git.status();
        console.log('Git Status:', status);
        
        // Trigger any registered commit hooks
        if (DocumentManager._commitHooks && DocumentManager._commitHooks.length > 0) {
            for (const hook of DocumentManager._commitHooks) {
                await hook(status);
            }
        }
        
        return { status, message: 'Git hooks responded successfully' };
    }, 'testCommit'),

    // Hook registration
    registerCommitHook: withErrorHandling(async (hook) => {
        if (!DocumentManager._commitHooks) {
            DocumentManager._commitHooks = [];
        }
        DocumentManager._commitHooks.push(hook);
    }, 'registerCommitHook')
};

// State access for debugging
export const getState = () => ({
    drafts: Object.fromEntries(drafts),
    hooks: DocumentManager._commitHooks?.length || 0
});

// Export main functions for compatibility
export const createDraft = DocumentManager.createDraft;
export const getDraft = DocumentManager.getDraft;
export const updateDraft = DocumentManager.updateDraft;
export const deleteDraft = DocumentManager.deleteDraft;
export const listDrafts = DocumentManager.listDrafts;
export const onCommit = DocumentManager.onCommit;
export const getGitStatus = DocumentManager.getGitStatus;
export const testCommit = DocumentManager.testCommit;

export default DocumentManager;