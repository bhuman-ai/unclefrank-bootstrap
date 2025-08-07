/**
 * Checkpoint-Isolated Claude Manager
 * Creates fresh Claude instances for each checkpoint to ensure contextless testing
 * Following Uncle Frank's methodology: Each checkpoint gets a clean slate
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class CheckpointClaudeManager {
    constructor() {
        this.tmuxConfig = '/etc/tmux.conf';
        this.mainSession = 'claude-checkpoint';
        this.activeWindows = new Map();
        this.windowCounter = 0;
    }

    /**
     * Initialize the main tmux session
     */
    async initialize() {
        try {
            // Check if main session exists
            await execAsync(`tmux has-session -t ${this.mainSession} 2>/dev/null`);
            console.log('Checkpoint session already exists');
        } catch {
            // Create main session (window 0 is for management/monitoring)
            console.log('Creating checkpoint tmux session...');
            await execAsync(`tmux -f ${this.tmuxConfig} new-session -d -s ${this.mainSession} -n manager "echo 'Checkpoint Manager Ready'"`)
            console.log('Checkpoint Claude Manager initialized');
        }
        return true;
    }

    /**
     * Create a FRESH Claude instance for a checkpoint
     * This ensures NO context pollution between checkpoints
     */
    async createFreshCheckpointInstance(checkpointId, workingDir = '/app') {
        const windowName = `checkpoint-${checkpointId}-${Date.now()}`;
        const windowIndex = ++this.windowCounter;
        
        console.log(`Creating fresh Claude instance for checkpoint: ${checkpointId}`);
        
        try {
            // Create new window with fresh Claude instance
            await execAsync(`tmux -f ${this.tmuxConfig} new-window -t ${this.mainSession}:${windowIndex} -n ${windowName} -c ${workingDir} "IS_SANDBOX=1 claude --dangerously-skip-permissions"`);
            
            // Wait for Claude to initialize
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Track the window
            this.activeWindows.set(checkpointId, {
                windowName,
                windowIndex,
                workingDir,
                created: new Date(),
                status: 'ready'
            });
            
            console.log(`Fresh instance ready for checkpoint ${checkpointId} in window ${windowIndex}`);
            return { windowName, windowIndex };
        } catch (error) {
            console.error(`Failed to create instance for checkpoint ${checkpointId}:`, error);
            throw error;
        }
    }

    /**
     * Execute a checkpoint in its own FRESH instance
     * CRITICAL: Each checkpoint gets a virgin Claude with NO prior context
     */
    async executeCheckpoint(checkpoint, repoPath) {
        const { id, name, test, passCriteria } = checkpoint;
        
        console.log(`\n=== EXECUTING CHECKPOINT ${id}: ${name} ===`);
        console.log(`Creating fresh, contextless Claude instance...`);
        
        // Create fresh instance for this checkpoint
        const instance = await this.createFreshCheckpointInstance(id, repoPath);
        
        try {
            // Build the checkpoint execution command
            const checkpointCommand = this.buildCheckpointCommand(checkpoint, repoPath);
            
            // Send command to the fresh instance
            const result = await this.sendToWindow(instance.windowIndex, checkpointCommand);
            
            // Wait for execution
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Capture test results
            const output = await this.captureWindowOutput(instance.windowIndex, 100);
            
            // Verify pass/fail criteria
            const passed = await this.verifyCheckpoint(output, passCriteria);
            
            return {
                checkpointId: id,
                name,
                passed,
                output,
                instance: instance.windowName,
                timestamp: new Date()
            };
        } finally {
            // IMPORTANT: Kill the window after checkpoint completes
            // This ensures the next checkpoint gets a completely fresh start
            await this.killCheckpointInstance(id);
        }
    }

    /**
     * Build checkpoint command with full context needed for isolated execution
     */
    buildCheckpointCommand(checkpoint, repoPath) {
        return `
# CHECKPOINT ${checkpoint.id}: ${checkpoint.name}
# This is a FRESH Claude instance with NO prior context
# Working directory: ${repoPath}

cd ${repoPath}

# Checkpoint Description:
${checkpoint.description}

# Test to perform:
${checkpoint.test}

# Pass/Fail Criteria:
${checkpoint.passCriteria}

# Execute this checkpoint NOW and report results clearly.
`;
    }

    /**
     * Send command to specific window
     */
    async sendToWindow(windowIndex, message) {
        const window = `${this.mainSession}:${windowIndex}`;
        
        // Send text first
        if (message && message.trim()) {
            const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/'/g, "'\\''");
            
            // Send line by line for multi-line commands
            const lines = escapedMessage.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    await execAsync(`tmux -f ${this.tmuxConfig} send-keys -t ${window} "${line}" Enter`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        return true;
    }

    /**
     * Capture output from a window
     */
    async captureWindowOutput(windowIndex, lines = 50) {
        const window = `${this.mainSession}:${windowIndex}`;
        const { stdout } = await execAsync(`tmux -f ${this.tmuxConfig} capture-pane -t ${window} -p -S -${lines}`);
        return stdout;
    }

    /**
     * Verify checkpoint passed based on criteria
     */
    async verifyCheckpoint(output, passCriteria) {
        // Simple verification - look for success indicators
        const successIndicators = [
            '✓', '✅', 'SUCCESS', 'PASSED', 'Complete', 
            'successfully', 'working', 'verified'
        ];
        
        const failureIndicators = [
            '✗', '❌', 'FAILED', 'ERROR', 'Failed',
            'error:', 'Error:', 'not found', 'undefined'
        ];
        
        const outputLower = output.toLowerCase();
        
        // Check for explicit failures first
        for (const indicator of failureIndicators) {
            if (outputLower.includes(indicator.toLowerCase())) {
                console.log(`Checkpoint FAILED - found: ${indicator}`);
                return false;
            }
        }
        
        // Check for success indicators
        for (const indicator of successIndicators) {
            if (outputLower.includes(indicator.toLowerCase())) {
                console.log(`Checkpoint PASSED - found: ${indicator}`);
                return true;
            }
        }
        
        // Default to false if uncertain
        console.log('Checkpoint result UNCERTAIN - marking as failed');
        return false;
    }

    /**
     * Kill a checkpoint instance (cleanup after execution)
     */
    async killCheckpointInstance(checkpointId) {
        const instance = this.activeWindows.get(checkpointId);
        if (!instance) {
            return;
        }
        
        try {
            await execAsync(`tmux -f ${this.tmuxConfig} kill-window -t ${this.mainSession}:${instance.windowIndex}`);
            this.activeWindows.delete(checkpointId);
            console.log(`Killed checkpoint instance: ${instance.windowName}`);
        } catch (error) {
            console.error(`Failed to kill checkpoint instance:`, error);
        }
    }

    /**
     * Execute multiple checkpoints in sequence with fresh instances
     */
    async executeCheckpointSequence(checkpoints, repoPath) {
        const results = [];
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`EXECUTING ${checkpoints.length} CHECKPOINTS`);
        console.log(`Each checkpoint gets a FRESH Claude instance`);
        console.log(`${'='.repeat(60)}\n`);
        
        for (const checkpoint of checkpoints) {
            try {
                const result = await this.executeCheckpoint(checkpoint, repoPath);
                results.push(result);
                
                if (!result.passed) {
                    console.log(`\n⚠️ CHECKPOINT ${checkpoint.id} FAILED - Stopping sequence`);
                    break; // Stop on first failure
                }
                
                console.log(`\n✅ CHECKPOINT ${checkpoint.id} PASSED - Continuing...`);
            } catch (error) {
                console.error(`\n❌ CHECKPOINT ${checkpoint.id} ERROR:`, error);
                results.push({
                    checkpointId: checkpoint.id,
                    name: checkpoint.name,
                    passed: false,
                    error: error.message,
                    timestamp: new Date()
                });
                break; // Stop on error
            }
        }
        
        return results;
    }

    /**
     * Get status of all active checkpoint instances
     */
    getStatus() {
        const status = {
            mainSession: this.mainSession,
            activeCheckpoints: this.activeWindows.size,
            totalWindowsCreated: this.windowCounter,
            instances: []
        };
        
        for (const [checkpointId, instance] of this.activeWindows) {
            status.instances.push({
                checkpointId,
                ...instance
            });
        }
        
        return status;
    }

    /**
     * View current state of checkpoint execution
     */
    async viewCheckpointProgress(checkpointId) {
        const instance = this.activeWindows.get(checkpointId);
        if (!instance) {
            throw new Error(`No active instance for checkpoint ${checkpointId}`);
        }
        
        const output = await this.captureWindowOutput(instance.windowIndex, 30);
        return {
            checkpointId,
            windowName: instance.windowName,
            output
        };
    }

    /**
     * Emergency cleanup - kill all checkpoint windows
     */
    async cleanup() {
        console.log('Cleaning up all checkpoint instances...');
        
        for (const [checkpointId] of this.activeWindows) {
            await this.killCheckpointInstance(checkpointId);
        }
        
        try {
            await execAsync(`tmux -f ${this.tmuxConfig} kill-session -t ${this.mainSession}`);
            console.log('Checkpoint session terminated');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

module.exports = CheckpointClaudeManager;

// Example usage for testing
if (require.main === module) {
    (async () => {
        const manager = new CheckpointClaudeManager();
        await manager.initialize();
        
        // Example checkpoints
        const checkpoints = [
            {
                id: 'CP1',
                name: 'API Integration Test',
                description: 'Test the document-manager API',
                test: 'curl -X POST http://localhost:8080/api/document-manager/create-draft -H "Content-Type: application/json" -d \'{"title":"Test","content":"Test content"}\'',
                passCriteria: 'Returns 201 status with draftId'
            },
            {
                id: 'CP2',
                name: 'File Creation Test',
                description: 'Verify draft files are created',
                test: 'ls -la /app/drafts/',
                passCriteria: 'Draft files exist in directory'
            }
        ];
        
        const results = await manager.executeCheckpointSequence(checkpoints, '/app');
        console.log('\nCheckpoint Results:', results);
        
        console.log('\nFinal Status:', manager.getStatus());
    })();
}