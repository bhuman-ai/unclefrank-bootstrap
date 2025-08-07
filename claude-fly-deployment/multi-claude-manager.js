/**
 * Multi-Claude Instance Manager
 * Manages multiple Claude instances within tmux for parallel task execution
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class MultiClaudeManager {
    constructor(maxInstances = 5) {
        this.maxInstances = maxInstances;
        this.instances = new Map();
        this.tmuxConfig = '/etc/tmux.conf';
        this.mainSession = 'claude-main';
    }

    /**
     * Initialize the main tmux session with multiple windows
     */
    async initialize() {
        try {
            // Check if main session exists
            await execAsync(`tmux has-session -t ${this.mainSession} 2>/dev/null`);
            console.log('Main session already exists');
        } catch {
            // Create main session with first Claude instance
            console.log('Creating main tmux session with multiple windows...');
            await execAsync(`tmux -f ${this.tmuxConfig} new-session -d -s ${this.mainSession} -n claude-0 "cd /app && IS_SANDBOX=1 claude --dangerously-skip-permissions"`);
            
            // Create additional windows for more Claude instances
            for (let i = 1; i < this.maxInstances; i++) {
                await execAsync(`tmux -f ${this.tmuxConfig} new-window -t ${this.mainSession}:${i} -n claude-${i} "cd /app && IS_SANDBOX=1 claude --dangerously-skip-permissions"`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between instances
            }
        }

        // Initialize instance tracking
        for (let i = 0; i < this.maxInstances; i++) {
            this.instances.set(`claude-${i}`, {
                window: i,
                busy: false,
                currentTask: null,
                created: new Date()
            });
        }

        console.log(`Initialized ${this.maxInstances} Claude instances`);
        return true;
    }

    /**
     * Get an available Claude instance
     */
    getAvailableInstance() {
        for (const [name, instance] of this.instances) {
            if (!instance.busy) {
                return { name, ...instance };
            }
        }
        return null; // All instances busy
    }

    /**
     * Send command to specific Claude instance
     */
    async sendToInstance(instanceName, message) {
        const instance = this.instances.get(instanceName);
        if (!instance) {
            throw new Error(`Instance ${instanceName} not found`);
        }

        // Mark as busy
        instance.busy = true;
        instance.currentTask = message.substring(0, 100);

        try {
            // Send to specific window
            const window = `${this.mainSession}:${instance.window}`;
            
            // Send text first
            if (message && message.trim()) {
                const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/'/g, "'\\''");
                await execAsync(`tmux -f ${this.tmuxConfig} send-keys -t ${window} "${escapedMessage}"`);
                
                // Wait for buffer
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Send Enter to execute
            await execAsync(`tmux -f ${this.tmuxConfig} send-keys -t ${window} Enter`);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Capture output
            const { stdout } = await execAsync(`tmux -f ${this.tmuxConfig} capture-pane -t ${window} -p -S -50`);
            
            return stdout;
        } finally {
            // Mark as available again
            instance.busy = false;
            instance.currentTask = null;
        }
    }

    /**
     * Execute task on any available instance
     */
    async executeTask(message) {
        const available = this.getAvailableInstance();
        
        if (!available) {
            // All instances busy - queue or wait
            console.log('All Claude instances busy, waiting...');
            
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 3000));
            return this.executeTask(message); // Recursive retry
        }

        console.log(`Executing on instance: ${available.name}`);
        return await this.sendToInstance(available.name, message);
    }

    /**
     * Get status of all instances
     */
    getStatus() {
        const status = {
            total: this.instances.size,
            available: 0,
            busy: 0,
            instances: []
        };

        for (const [name, instance] of this.instances) {
            if (instance.busy) {
                status.busy++;
            } else {
                status.available++;
            }
            
            status.instances.push({
                name,
                window: instance.window,
                busy: instance.busy,
                currentTask: instance.currentTask
            });
        }

        return status;
    }

    /**
     * Kill a specific instance
     */
    async killInstance(instanceName) {
        const instance = this.instances.get(instanceName);
        if (!instance) {
            throw new Error(`Instance ${instanceName} not found`);
        }

        // Kill the window
        await execAsync(`tmux -f ${this.tmuxConfig} kill-window -t ${this.mainSession}:${instance.window}`);
        this.instances.delete(instanceName);
    }

    /**
     * Restart a specific instance
     */
    async restartInstance(instanceName) {
        const instance = this.instances.get(instanceName);
        if (!instance) {
            throw new Error(`Instance ${instanceName} not found`);
        }

        // Kill and recreate the window
        await this.killInstance(instanceName);
        
        // Recreate
        await execAsync(`tmux -f ${this.tmuxConfig} new-window -t ${this.mainSession}:${instance.window} -n ${instanceName} "cd /app && IS_SANDBOX=1 claude --dangerously-skip-permissions"`);
        
        // Re-add to tracking
        this.instances.set(instanceName, {
            window: instance.window,
            busy: false,
            currentTask: null,
            created: new Date()
        });
    }

    /**
     * View output from specific instance
     */
    async viewInstance(instanceName, lines = 50) {
        const instance = this.instances.get(instanceName);
        if (!instance) {
            throw new Error(`Instance ${instanceName} not found`);
        }

        const { stdout } = await execAsync(`tmux -f ${this.tmuxConfig} capture-pane -t ${this.mainSession}:${instance.window} -p -S -${lines}`);
        return stdout;
    }

    /**
     * Cleanup all instances
     */
    async cleanup() {
        try {
            await execAsync(`tmux -f ${this.tmuxConfig} kill-session -t ${this.mainSession}`);
            console.log('Cleaned up all Claude instances');
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }
}

// Export for use in server
module.exports = MultiClaudeManager;

// Example usage:
if (require.main === module) {
    (async () => {
        const manager = new MultiClaudeManager(3); // 3 Claude instances
        await manager.initialize();
        
        // Get status
        console.log('Status:', manager.getStatus());
        
        // Execute tasks in parallel
        const tasks = [
            manager.executeTask('ls -la'),
            manager.executeTask('pwd'),
            manager.executeTask('echo "Hello from Claude"')
        ];
        
        const results = await Promise.all(tasks);
        console.log('Results:', results.map(r => r.substring(0, 100)));
        
        // View specific instance
        const output = await manager.viewInstance('claude-0');
        console.log('Claude-0 output:', output.substring(0, 200));
    })();
}