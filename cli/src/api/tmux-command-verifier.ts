/**
 * Tmux Command Verifier
 * SACRED PRINCIPLE: Verify tmux commands actually executed
 * Uncle Frank says: "Just because tmux didn't error doesn't mean it worked"
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TmuxExecutionResult {
    executed: boolean;
    sessionExists: boolean;
    windowActive: boolean;
    commandSent: boolean;
    outputChanged: boolean;
    error?: string;
}

export class TmuxCommandVerifier {
    private tmuxConfig = '/etc/tmux.conf';

    /**
     * Verify that a tmux command was actually executed
     * Not just "did tmux return 0" but "did the command actually run"
     */
    async verifyTmuxExecution(
        sessionName: string,
        windowName: string | number,
        commandSent: string
    ): Promise<TmuxExecutionResult> {
        console.log('🔍 Frank is verifying tmux command execution...');
        
        const result: TmuxExecutionResult = {
            executed: false,
            sessionExists: false,
            windowActive: false,
            commandSent: false,
            outputChanged: false
        };

        try {
            // Step 1: Verify session exists
            result.sessionExists = await this.verifySessionExists(sessionName);
            if (!result.sessionExists) {
                result.error = `Session ${sessionName} does not exist`;
                return result;
            }

            // Step 2: Verify window is active
            result.windowActive = await this.verifyWindowActive(sessionName, windowName);
            if (!result.windowActive) {
                result.error = `Window ${windowName} is not active`;
                return result;
            }

            // Step 3: Capture output before command
            const outputBefore = await this.captureWindowOutput(sessionName, windowName);

            // Step 4: Send the command
            result.commandSent = await this.sendCommand(sessionName, windowName, commandSent);
            if (!result.commandSent) {
                result.error = 'Failed to send command to tmux';
                return result;
            }

            // Step 5: Wait for command to process
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 6: Capture output after command
            const outputAfter = await this.captureWindowOutput(sessionName, windowName);

            // Step 7: Verify output changed
            result.outputChanged = outputBefore !== outputAfter;
            if (!result.outputChanged) {
                // Try capturing more lines in case of buffer issues
                const extendedOutput = await this.captureWindowOutput(sessionName, windowName, 100);
                result.outputChanged = extendedOutput.length > outputBefore.length;
            }

            // Step 8: Check for command echo in output
            if (commandSent && outputAfter.includes(commandSent.substring(0, 20))) {
                result.commandSent = true;
            }

            // Determine overall execution success
            result.executed = result.sessionExists && 
                             result.windowActive && 
                             result.commandSent && 
                             result.outputChanged;

        } catch (error) {
            result.error = `Verification failed: ${error.message}`;
            result.executed = false;
        }

        console.log(`Tmux verification: ${result.executed ? '✅' : '❌'}`);
        return result;
    }

    /**
     * Verify tmux session exists
     */
    private async verifySessionExists(sessionName: string): Promise<boolean> {
        try {
            const { stdout } = await execAsync(`tmux has-session -t ${sessionName} 2>/dev/null`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verify window is active and responding
     */
    private async verifyWindowActive(sessionName: string, windowName: string | number): Promise<boolean> {
        try {
            const target = `${sessionName}:${windowName}`;
            const { stdout } = await execAsync(`tmux list-windows -t ${sessionName} 2>/dev/null`);
            
            // Check if window exists in list
            if (typeof windowName === 'string') {
                return stdout.includes(windowName);
            } else {
                return stdout.includes(`${windowName}:`);
            }
        } catch {
            return false;
        }
    }

    /**
     * Capture current window output
     */
    private async captureWindowOutput(
        sessionName: string, 
        windowName: string | number,
        lines: number = 50
    ): Promise<string> {
        try {
            const target = `${sessionName}:${windowName}`;
            const { stdout } = await execAsync(
                `tmux -f ${this.tmuxConfig} capture-pane -t ${target} -p -S -${lines} 2>/dev/null`
            );
            return stdout;
        } catch {
            return '';
        }
    }

    /**
     * Send command to tmux window
     */
    private async sendCommand(
        sessionName: string,
        windowName: string | number,
        command: string
    ): Promise<boolean> {
        try {
            const target = `${sessionName}:${windowName}`;
            const escapedCommand = command.replace(/"/g, '\\"').replace(/\$/g, '\\$');
            
            // Send the command
            await execAsync(`tmux -f ${this.tmuxConfig} send-keys -t ${target} "${escapedCommand}"`);
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Send Enter
            await execAsync(`tmux -f ${this.tmuxConfig} send-keys -t ${target} Enter`);
            
            return true;
        } catch (error) {
            console.error('Failed to send command:', error);
            return false;
        }
    }

    /**
     * Verify Claude is responding in tmux
     */
    async verifyClaudeResponding(sessionName: string): Promise<boolean> {
        console.log('🤖 Checking if Claude is responding...');
        
        try {
            // Send a simple echo command
            const testCommand = 'echo "CLAUDE_RESPONDING_TEST_' + Date.now() + '"';
            const result = await this.verifyTmuxExecution(
                sessionName,
                0, // Main window
                testCommand
            );
            
            if (!result.executed) {
                return false;
            }
            
            // Check if Claude processed it
            const output = await this.captureWindowOutput(sessionName, 0, 20);
            return output.includes('CLAUDE_RESPONDING_TEST');
            
        } catch (error) {
            console.error('Claude response check failed:', error);
            return false;
        }
    }

    /**
     * Monitor tmux session health
     */
    async monitorSessionHealth(sessionName: string): Promise<{
        healthy: boolean;
        sessions: number;
        windows: number;
        responsive: boolean;
        details: any;
    }> {
        console.log('🏥 Frank is checking tmux health...');
        
        try {
            // Count sessions
            const { stdout: sessions } = await execAsync('tmux list-sessions 2>/dev/null | wc -l');
            
            // Count windows in target session
            const { stdout: windows } = await execAsync(
                `tmux list-windows -t ${sessionName} 2>/dev/null | wc -l`
            );
            
            // Check responsiveness
            const responsive = await this.verifyClaudeResponding(sessionName);
            
            // Get memory usage
            const { stdout: memory } = await execAsync(
                `tmux list-panes -t ${sessionName} -F "#{pane_pid}" | xargs ps -o rss= | awk '{sum+=$1} END {print sum/1024 " MB"}'`
            );
            
            return {
                healthy: parseInt(sessions) > 0 && parseInt(windows) > 0 && responsive,
                sessions: parseInt(sessions),
                windows: parseInt(windows),
                responsive,
                details: {
                    memory: memory.trim(),
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                healthy: false,
                sessions: 0,
                windows: 0,
                responsive: false,
                details: { error: error.message }
            };
        }
    }

    /**
     * Restart tmux session if unhealthy
     */
    async restartIfUnhealthy(sessionName: string): Promise<boolean> {
        const health = await this.monitorSessionHealth(sessionName);
        
        if (!health.healthy) {
            console.log('⚠️ Session unhealthy, attempting restart...');
            
            try {
                // Kill existing session
                await execAsync(`tmux kill-session -t ${sessionName} 2>/dev/null`);
                
                // Wait a moment
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Create new session
                await execAsync(
                    `tmux -f ${this.tmuxConfig} new-session -d -s ${sessionName} -c /app "IS_SANDBOX=1 claude --dangerously-skip-permissions"`
                );
                
                // Wait for initialization
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Verify it's working
                const newHealth = await this.monitorSessionHealth(sessionName);
                
                if (newHealth.healthy) {
                    console.log('✅ Session restarted successfully');
                    return true;
                } else {
                    console.log('❌ Restart failed');
                    return false;
                }
            } catch (error) {
                console.error('Restart error:', error);
                return false;
            }
        }
        
        return true; // Already healthy
    }
}

// Export singleton
export const tmuxVerifier = new TmuxCommandVerifier();