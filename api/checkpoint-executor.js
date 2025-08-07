/**
 * Checkpoint Executor API
 * Executes checkpoints with FRESH Claude instances for each test
 * Ensures complete isolation - no context pollution between tests
 */

const express = require('express');
const router = express.Router();
const CheckpointClaudeManager = require('../claude-fly-deployment/checkpoint-claude-manager');

// Initialize checkpoint manager
const checkpointManager = new CheckpointClaudeManager();
let managerReady = false;

// Initialize on first use
async function ensureManagerReady() {
    if (!managerReady) {
        await checkpointManager.initialize();
        managerReady = true;
    }
}

/**
 * Execute a single checkpoint with a fresh Claude instance
 * POST /api/checkpoint-executor/execute-single
 */
router.post('/execute-single', async (req, res) => {
    try {
        await ensureManagerReady();
        
        const { checkpoint, repoPath = '/app' } = req.body;
        
        if (!checkpoint) {
            return res.status(400).json({ 
                error: 'Checkpoint definition required' 
            });
        }
        
        console.log(`[Checkpoint Executor] Executing checkpoint ${checkpoint.id} in fresh instance`);
        
        const result = await checkpointManager.executeCheckpoint(checkpoint, repoPath);
        
        res.json({
            success: true,
            result,
            message: result.passed ? 
                `✅ Checkpoint ${checkpoint.id} PASSED` : 
                `❌ Checkpoint ${checkpoint.id} FAILED`
        });
    } catch (error) {
        console.error('[Checkpoint Executor] Error:', error);
        res.status(500).json({ 
            error: 'Checkpoint execution failed',
            details: error.message 
        });
    }
});

/**
 * Execute multiple checkpoints in sequence
 * Each gets a FRESH Claude instance - no context carryover
 * POST /api/checkpoint-executor/execute-sequence
 */
router.post('/execute-sequence', async (req, res) => {
    try {
        await ensureManagerReady();
        
        const { checkpoints, repoPath = '/app' } = req.body;
        
        if (!checkpoints || !Array.isArray(checkpoints)) {
            return res.status(400).json({ 
                error: 'Checkpoints array required' 
            });
        }
        
        console.log(`[Checkpoint Executor] Starting sequence of ${checkpoints.length} checkpoints`);
        console.log('[Checkpoint Executor] Each checkpoint gets a FRESH Claude instance');
        
        const results = await checkpointManager.executeCheckpointSequence(checkpoints, repoPath);
        
        const allPassed = results.every(r => r.passed);
        const passedCount = results.filter(r => r.passed).length;
        
        res.json({
            success: allPassed,
            totalCheckpoints: checkpoints.length,
            passedCount,
            failedCount: checkpoints.length - passedCount,
            results,
            message: allPassed ? 
                `✅ All ${checkpoints.length} checkpoints PASSED` : 
                `⚠️ ${passedCount}/${checkpoints.length} checkpoints passed`
        });
    } catch (error) {
        console.error('[Checkpoint Executor] Sequence error:', error);
        res.status(500).json({ 
            error: 'Checkpoint sequence execution failed',
            details: error.message 
        });
    }
});

/**
 * View progress of a currently executing checkpoint
 * GET /api/checkpoint-executor/progress/:checkpointId
 */
router.get('/progress/:checkpointId', async (req, res) => {
    try {
        const { checkpointId } = req.params;
        
        const progress = await checkpointManager.viewCheckpointProgress(checkpointId);
        
        res.json({
            success: true,
            ...progress
        });
    } catch (error) {
        res.status(404).json({ 
            error: 'Checkpoint not found or not active',
            details: error.message 
        });
    }
});

/**
 * Get status of all checkpoint instances
 * GET /api/checkpoint-executor/status
 */
router.get('/status', async (req, res) => {
    try {
        await ensureManagerReady();
        
        const status = checkpointManager.getStatus();
        
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to get status',
            details: error.message 
        });
    }
});

/**
 * Test endpoint - execute a simple checkpoint test
 * POST /api/checkpoint-executor/test
 */
router.post('/test', async (req, res) => {
    try {
        await ensureManagerReady();
        
        // Simple test checkpoint
        const testCheckpoint = {
            id: 'TEST-1',
            name: 'System Test',
            description: 'Test that Claude can execute in fresh instance',
            test: 'echo "Fresh Claude instance test" && pwd && ls -la',
            passCriteria: 'Shows current directory and file listing'
        };
        
        console.log('[Checkpoint Executor] Running test checkpoint...');
        
        const result = await checkpointManager.executeCheckpoint(testCheckpoint, '/app');
        
        res.json({
            success: true,
            message: 'Test checkpoint executed',
            result
        });
    } catch (error) {
        console.error('[Checkpoint Executor] Test error:', error);
        res.status(500).json({ 
            error: 'Test failed',
            details: error.message 
        });
    }
});

/**
 * Emergency cleanup - kill all checkpoint instances
 * POST /api/checkpoint-executor/cleanup
 */
router.post('/cleanup', async (req, res) => {
    try {
        await checkpointManager.cleanup();
        managerReady = false;
        
        res.json({
            success: true,
            message: 'All checkpoint instances cleaned up'
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Cleanup failed',
            details: error.message 
        });
    }
});

module.exports = router;