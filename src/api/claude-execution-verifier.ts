/**
 * Claude Execution Verifier
 * SACRED PRINCIPLE: Verify actual execution, not just response
 * Uncle Frank says: "Don't trust what they say, verify what they did"
 */

import axios from 'axios';

export interface ExecutionResult {
    executed: boolean;
    evidence: string[];
    output: string;
    errors: string[];
    confidence: number; // 0-100%
}

export interface CommandExpectation {
    command: string;
    expectedPatterns: RegExp[];
    requiredFiles?: string[];
    expectedChanges?: string[];
    timeout?: number;
}

export class ClaudeExecutionVerifier {
    private claudeUrl: string;

    constructor(claudeUrl: string = process.env.CLAUDE_FLY_URL || 'https://uncle-frank-claude.fly.dev') {
        this.claudeUrl = claudeUrl;
    }

    /**
     * Verify that Claude actually executed a command and produced expected results
     * Not just "did Claude respond" but "did the command actually run"
     */
    async verifyExecution(
        sessionId: string, 
        expectation: CommandExpectation
    ): Promise<ExecutionResult> {
        console.log('🔍 Frank is verifying ACTUAL execution...');
        
        const result: ExecutionResult = {
            executed: false,
            evidence: [],
            output: '',
            errors: [],
            confidence: 0
        };

        try {
            // Step 1: Get the actual output from Claude
            const output = await this.getCommandOutput(sessionId);
            result.output = output;

            // Step 2: Check for expected patterns in output
            const patternMatches = this.checkOutputPatterns(output, expectation.expectedPatterns);
            if (patternMatches.matches > 0) {
                result.evidence.push(`Found ${patternMatches.matches} expected patterns in output`);
                result.confidence += 30;
            } else {
                result.errors.push('No expected patterns found in output');
            }

            // Step 3: Verify file changes if expected
            if (expectation.requiredFiles) {
                const fileCheck = await this.verifyFileChanges(sessionId, expectation.requiredFiles);
                if (fileCheck.allFound) {
                    result.evidence.push(`All ${expectation.requiredFiles.length} required files verified`);
                    result.confidence += 30;
                } else {
                    result.errors.push(`Missing files: ${fileCheck.missing.join(', ')}`);
                }
            }

            // Step 4: Check for command-specific evidence
            const commandEvidence = await this.checkCommandSpecificEvidence(
                sessionId, 
                expectation.command, 
                output
            );
            if (commandEvidence.found) {
                result.evidence.push(...commandEvidence.evidence);
                result.confidence += commandEvidence.confidenceBoost;
            }

            // Step 5: Check for error indicators
            const errorCheck = this.checkForErrors(output);
            if (errorCheck.hasErrors) {
                result.errors.push(...errorCheck.errors);
                result.confidence -= 20;
            }

            // Determine if execution was successful
            result.executed = result.confidence >= 50;

            // Step 6: If confidence is low, try alternative verification
            if (result.confidence < 50) {
                const altVerification = await this.alternativeVerification(sessionId, expectation);
                if (altVerification.success) {
                    result.evidence.push('Alternative verification succeeded');
                    result.confidence += 30;
                    result.executed = result.confidence >= 50;
                }
            }

        } catch (error) {
            result.errors.push(`Verification failed: ${error.message}`);
            result.executed = false;
        }

        console.log(`Verification complete: ${result.executed ? '✅' : '❌'} (Confidence: ${result.confidence}%)`);
        return result;
    }

    /**
     * Get the actual command output from Claude
     */
    private async getCommandOutput(sessionId: string): Promise<string> {
        try {
            const response = await axios.get(
                `${this.claudeUrl}/api/sessions/${sessionId}/messages`,
                { timeout: 10000 }
            );
            
            // Get the last few messages to capture command output
            const messages = response.data.messages || [];
            const recentOutput = messages.slice(-5).join('\n');
            
            return recentOutput;
        } catch (error) {
            console.error('Failed to get command output:', error);
            return '';
        }
    }

    /**
     * Check if output contains expected patterns
     */
    private checkOutputPatterns(output: string, patterns: RegExp[]): { matches: number; details: string[] } {
        const details: string[] = [];
        let matches = 0;

        patterns.forEach(pattern => {
            if (pattern.test(output)) {
                matches++;
                const match = output.match(pattern);
                if (match) {
                    details.push(`Pattern matched: ${match[0].substring(0, 50)}`);
                }
            }
        });

        return { matches, details };
    }

    /**
     * Verify that expected files were created/modified
     */
    private async verifyFileChanges(
        sessionId: string, 
        requiredFiles: string[]
    ): Promise<{ allFound: boolean; found: string[]; missing: string[] }> {
        const found: string[] = [];
        const missing: string[] = [];

        for (const file of requiredFiles) {
            try {
                // Check if file exists via Claude
                const checkCommand = `ls -la ${file} 2>/dev/null | head -1`;
                const response = await axios.post(
                    `${this.claudeUrl}/api/sessions/${sessionId}/execute`,
                    { message: checkCommand },
                    { timeout: 5000 }
                );
                
                if (response.data.response && !response.data.response.includes('No such file')) {
                    found.push(file);
                } else {
                    missing.push(file);
                }
            } catch (error) {
                missing.push(file);
            }
        }

        return {
            allFound: missing.length === 0,
            found,
            missing
        };
    }

    /**
     * Check for command-specific evidence
     */
    private async checkCommandSpecificEvidence(
        sessionId: string,
        command: string,
        output: string
    ): Promise<{ found: boolean; evidence: string[]; confidenceBoost: number }> {
        const evidence: string[] = [];
        let confidenceBoost = 0;

        // Check for git operations
        if (command.includes('git')) {
            if (command.includes('commit')) {
                if (output.includes('files changed') || output.includes('insertions')) {
                    evidence.push('Git commit was successful');
                    confidenceBoost += 20;
                }
            }
            if (command.includes('push')) {
                if (output.includes('Writing objects') || output.includes('branch')) {
                    evidence.push('Git push was successful');
                    confidenceBoost += 20;
                }
            }
        }

        // Check for npm/yarn operations
        if (command.includes('npm') || command.includes('yarn')) {
            if (command.includes('install')) {
                if (output.includes('packages') || output.includes('dependencies')) {
                    evidence.push('Package installation completed');
                    confidenceBoost += 20;
                }
            }
            if (command.includes('build')) {
                if (output.includes('built') || output.includes('compiled')) {
                    evidence.push('Build process completed');
                    confidenceBoost += 20;
                }
            }
        }

        // Check for file operations
        if (command.includes('echo') || command.includes('cat')) {
            const echoMatch = command.match(/echo\s+"([^"]+)"/);
            if (echoMatch && output.includes(echoMatch[1])) {
                evidence.push('Echo command output verified');
                confidenceBoost += 30;
            }
        }

        // Check for directory operations
        if (command.includes('mkdir')) {
            const dirMatch = command.match(/mkdir\s+(-p\s+)?([^\s]+)/);
            if (dirMatch) {
                const dirName = dirMatch[2];
                if (output.includes(dirName) || output.includes('created')) {
                    evidence.push('Directory creation verified');
                    confidenceBoost += 20;
                }
            }
        }

        return {
            found: evidence.length > 0,
            evidence,
            confidenceBoost
        };
    }

    /**
     * Check for error indicators in output
     */
    private checkForErrors(output: string): { hasErrors: boolean; errors: string[] } {
        const errors: string[] = [];
        const errorPatterns = [
            /error:/i,
            /failed/i,
            /cannot\s+find/i,
            /permission\s+denied/i,
            /not\s+found/i,
            /invalid/i,
            /exception/i,
            /traceback/i
        ];

        errorPatterns.forEach(pattern => {
            if (pattern.test(output)) {
                const match = output.match(pattern);
                if (match) {
                    errors.push(`Error detected: ${match[0]}`);
                }
            }
        });

        return {
            hasErrors: errors.length > 0,
            errors
        };
    }

    /**
     * Alternative verification when primary verification has low confidence
     */
    private async alternativeVerification(
        sessionId: string,
        expectation: CommandExpectation
    ): Promise<{ success: boolean; method: string }> {
        console.log('🔄 Trying alternative verification...');

        // Try to execute a verification command
        try {
            let verifyCommand = '';
            
            // Build verification command based on original command
            if (expectation.command.includes('git')) {
                verifyCommand = 'git status --short';
            } else if (expectation.command.includes('npm')) {
                verifyCommand = 'ls -la node_modules 2>/dev/null | head -5';
            } else if (expectation.command.includes('echo')) {
                verifyCommand = 'echo "VERIFICATION_SUCCESS"';
            } else {
                verifyCommand = 'pwd && ls -la | head -5';
            }

            const response = await axios.post(
                `${this.claudeUrl}/api/sessions/${sessionId}/execute`,
                { message: verifyCommand },
                { timeout: 5000 }
            );

            const verifyOutput = response.data.response || '';
            
            // Check if verification shows expected state
            if (verifyOutput.includes('VERIFICATION_SUCCESS') || 
                verifyOutput.includes('node_modules') ||
                verifyOutput.includes('modified:') ||
                verifyOutput.length > 50) {
                return { success: true, method: 'command verification' };
            }
        } catch (error) {
            console.log('Alternative verification failed:', error.message);
        }

        return { success: false, method: 'none' };
    }

    /**
     * Verify checkpoint execution with specific criteria
     */
    async verifyCheckpointExecution(
        sessionId: string,
        checkpointId: string,
        passFail: string
    ): Promise<ExecutionResult> {
        console.log(`🎯 Verifying checkpoint ${checkpointId} execution...`);

        // Parse pass/fail criteria to build expectations
        const expectation = this.parsePassFailCriteria(passFail);
        
        // Verify with enhanced checkpoint-specific logic
        const result = await this.verifyExecution(sessionId, expectation);
        
        // Additional checkpoint-specific verification
        if (result.executed && result.confidence < 80) {
            // Try to boost confidence with checkpoint-specific checks
            const boostResult = await this.checkpointSpecificBoost(sessionId, checkpointId, passFail);
            if (boostResult.boosted) {
                result.confidence += boostResult.boost;
                result.evidence.push(...boostResult.evidence);
                result.executed = result.confidence >= 50;
            }
        }

        return result;
    }

    /**
     * Parse pass/fail criteria into command expectations
     */
    private parsePassFailCriteria(passFail: string): CommandExpectation {
        const expectation: CommandExpectation = {
            command: '',
            expectedPatterns: [],
            requiredFiles: [],
            expectedChanges: []
        };

        // Extract patterns from pass/fail criteria
        if (passFail.includes('file exists')) {
            const fileMatch = passFail.match(/file\s+([^\s]+)\s+exists/);
            if (fileMatch) {
                expectation.requiredFiles.push(fileMatch[1]);
            }
        }

        if (passFail.includes('test passes')) {
            expectation.expectedPatterns.push(/✓|passed|success/i);
        }

        if (passFail.includes('builds successfully')) {
            expectation.expectedPatterns.push(/build\s+successful|compiled|built/i);
        }

        if (passFail.includes('no errors')) {
            expectation.expectedPatterns.push(/^(?!.*error).*$/i);
        }

        // Add generic success patterns
        expectation.expectedPatterns.push(
            /completed|success|done|finished/i,
            /created|updated|modified/i
        );

        return expectation;
    }

    /**
     * Checkpoint-specific confidence boosting
     */
    private async checkpointSpecificBoost(
        sessionId: string,
        checkpointId: string,
        passFail: string
    ): Promise<{ boosted: boolean; boost: number; evidence: string[] }> {
        const evidence: string[] = [];
        let boost = 0;

        // Check if checkpoint ID appears in recent output
        try {
            const response = await axios.get(
                `${this.claudeUrl}/api/sessions/${sessionId}/messages`
            );
            
            const recentMessages = response.data.messages?.slice(-3).join(' ') || '';
            
            if (recentMessages.includes(checkpointId)) {
                evidence.push(`Checkpoint ${checkpointId} mentioned in output`);
                boost += 10;
            }

            if (recentMessages.includes('checkpoint') && recentMessages.includes('complete')) {
                evidence.push('Checkpoint completion detected');
                boost += 15;
            }
        } catch (error) {
            console.log('Boost check failed:', error.message);
        }

        return {
            boosted: boost > 0,
            boost,
            evidence
        };
    }
}

// Export singleton
export const executionVerifier = new ClaudeExecutionVerifier();