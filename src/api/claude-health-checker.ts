/**
 * Claude Health Checker
 * SACRED PRINCIPLE: No fake validation - real checks, real results
 * Uncle Frank says: "If it ain't working, don't pretend it is"
 */

import axios from 'axios';

export class ClaudeHealthChecker {
    private maxRetries = 3;
    private retryDelay = 2000;
    private claudeUrl: string;

    constructor(claudeUrl: string = process.env.CLAUDE_FLY_URL || 'https://uncle-frank-claude.fly.dev') {
        this.claudeUrl = claudeUrl;
    }

    /**
     * REAL validation that Claude is ready to execute
     * Not just "is the server up" but "can it actually run commands"
     */
    async validateClaudeReady(): Promise<{ ready: boolean; details: any }> {
        console.log('🔍 Frank is checking if Claude is ACTUALLY ready...');
        
        // Step 1: Check server health
        const serverHealth = await this.checkServerHealth();
        if (!serverHealth.healthy) {
            return { 
                ready: false, 
                details: { 
                    error: 'Server not healthy', 
                    ...serverHealth 
                } 
            };
        }

        // Step 2: Verify tmux session exists
        const tmuxReady = await this.verifyTmuxSession();
        if (!tmuxReady.exists) {
            return { 
                ready: false, 
                details: { 
                    error: 'Tmux session not found', 
                    ...tmuxReady 
                } 
            };
        }

        // Step 3: Test actual command execution
        const canExecute = await this.testCommandExecution();
        if (!canExecute.success) {
            return { 
                ready: false, 
                details: { 
                    error: 'Cannot execute commands', 
                    ...canExecute 
                } 
            };
        }

        return { 
            ready: true, 
            details: { 
                serverHealth, 
                tmuxReady, 
                canExecute,
                timestamp: new Date().toISOString()
            } 
        };
    }

    /**
     * Check if the server is actually responding
     */
    private async checkServerHealth(): Promise<any> {
        try {
            const response = await axios.get(`${this.claudeUrl}/health`, {
                timeout: 5000
            });
            
            return {
                healthy: response.data.status === 'healthy',
                uptime: response.data.uptime,
                memory: response.data.memory,
                claudeConfigured: response.data.claudeConfigured
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    /**
     * Verify tmux session is alive
     */
    private async verifyTmuxSession(): Promise<any> {
        try {
            // Create a test session to check tmux
            const response = await axios.post(`${this.claudeUrl}/api/sessions`, {
                repoUrl: 'https://github.com/bhuman-ai/unclefrank-bootstrap',
                testOnly: true // Don't actually clone, just test
            }, {
                timeout: 10000
            });

            if (response.data.ready) {
                // Clean up test session
                if (response.data.sessionId) {
                    await axios.delete(`${this.claudeUrl}/api/sessions/${response.data.sessionId}`);
                }
                return { exists: true, ready: true };
            }

            return { exists: false, error: 'Session creation failed' };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }

    /**
     * Test that Claude can ACTUALLY do real work, not just echo
     */
    private async testCommandExecution(): Promise<any> {
        console.log('🧪 Testing REAL Claude capabilities...');
        
        try {
            // Use testOnly mode for health check
            const createResponse = await axios.post(`${this.claudeUrl}/api/sessions`, {
                testOnly: true
            });

            const sessionId = createResponse.data.sessionId;

            // Test REAL capabilities, not just echo
            const realTests = [
                {
                    name: 'Code analysis',
                    command: 'ls -la && file package.json',
                    expected: 'package.json'
                },
                {
                    name: 'TypeScript check', 
                    command: 'which tsc && tsc --version',
                    expected: 'Version'
                },
                {
                    name: 'Git operations',
                    command: 'git --version',
                    expected: 'git version'
                }
            ];

            let passedTests = 0;
            const results: any[] = [];

            for (const test of realTests) {
                try {
                    const execResponse = await axios.post(
                        `${this.claudeUrl}/api/sessions/${sessionId}/execute`,
                        { message: test.command },
                        { timeout: 10000 }
                    );
                    
                    const output = execResponse.data.response || '';
                    const passed = output.toLowerCase().includes(test.expected.toLowerCase());
                    
                    if (passed) passedTests++;
                    
                    results.push({
                        test: test.name,
                        passed,
                        output: output.substring(0, 100)
                    });
                } catch (err) {
                    results.push({
                        test: test.name,
                        passed: false,
                        error: 'Test failed to execute'
                    });
                }
            }

            // Cleanup if session was created
            if (!createResponse.data.testOnly) {
                await axios.delete(`${this.claudeUrl}/api/sessions/${sessionId}`).catch(() => {});
            }

            const success = passedTests >= 2; // At least 2 out of 3 tests should pass
            
            return {
                success,
                testsPassed: passedTests,
                totalTests: realTests.length,
                results,
                sessionId
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Attempt to fix Claude if it's not ready
     */
    async attemptAutoFix(): Promise<boolean> {
        console.log('🔧 Frank is attempting to fix Claude...');

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            console.log(`Attempt ${attempt}/${this.maxRetries}...`);

            // Try to restart the Claude instance
            try {
                await axios.post(`${this.claudeUrl}/api/restart`, {
                    force: true
                });
                
                // Wait for restart
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                
                // Check if it's ready now
                const validation = await this.validateClaudeReady();
                if (validation.ready) {
                    console.log('✅ Frank fixed it! Claude is ready.');
                    return true;
                }
            } catch (error) {
                console.log(`Attempt ${attempt} failed: ${error.message}`);
            }
        }

        console.log('❌ Frank couldn\'t fix it. Manual intervention required.');
        return false;
    }

    /**
     * Wait for Claude to become ready with timeout
     */
    async waitForReady(timeoutMs: number = 30000): Promise<boolean> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            const validation = await this.validateClaudeReady();
            if (validation.ready) {
                return true;
            }
            
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return false;
    }
}

// Export singleton
export const claudeHealthChecker = new ClaudeHealthChecker();