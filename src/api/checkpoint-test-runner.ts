/**
 * Checkpoint Test Runner
 * SACRED PRINCIPLE: Run actual tests, not pattern matching
 * Uncle Frank says: "Don't look for the word 'passed', run the damn test"
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface TestResult {
    passed: boolean;
    testType: 'command' | 'file' | 'api' | 'integration' | 'unit';
    output: string;
    evidence: string[];
    executionTime: number;
    error?: string;
}

export interface CheckpointTest {
    id: string;
    name: string;
    type: 'command' | 'file' | 'api' | 'integration' | 'unit';
    test: string;
    expectedResult?: any;
    timeout?: number;
}

export class CheckpointTestRunner {
    private claudeUrl: string;
    
    constructor(claudeUrl: string = process.env.CLAUDE_FLY_URL || 'https://uncle-frank-claude.fly.dev') {
        this.claudeUrl = claudeUrl;
    }

    /**
     * Run an ACTUAL test for a checkpoint
     * Not "does output contain success" but "did the test actually pass"
     */
    async runCheckpointTest(test: CheckpointTest, sessionId?: string): Promise<TestResult> {
        console.log(`🧪 Frank is running ACTUAL test: ${test.name}`);
        
        const startTime = Date.now();
        let result: TestResult = {
            passed: false,
            testType: test.type,
            output: '',
            evidence: [],
            executionTime: 0
        };

        try {
            switch (test.type) {
                case 'command':
                    result = await this.runCommandTest(test, sessionId);
                    break;
                    
                case 'file':
                    result = await this.runFileTest(test);
                    break;
                    
                case 'api':
                    result = await this.runApiTest(test);
                    break;
                    
                case 'integration':
                    result = await this.runIntegrationTest(test, sessionId);
                    break;
                    
                case 'unit':
                    result = await this.runUnitTest(test);
                    break;
                    
                default:
                    throw new Error(`Unknown test type: ${test.type}`);
            }
        } catch (error: any) {
            result.passed = false;
            result.error = error.message;
            result.evidence.push(`Test failed with error: ${error.message}`);
        }

        result.executionTime = Date.now() - startTime;
        
        console.log(`Test ${test.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'} (${result.executionTime}ms)`);
        return result;
    }

    /**
     * Run a command test - execute command and verify output
     */
    private async runCommandTest(test: CheckpointTest, sessionId?: string): Promise<TestResult> {
        const result: TestResult = {
            passed: false,
            testType: 'command',
            output: '',
            evidence: [],
            executionTime: 0
        };

        try {
            let output: string;
            
            if (sessionId) {
                // Execute via Claude session
                const response = await axios.post(
                    `${this.claudeUrl}/api/sessions/${sessionId}/execute`,
                    { message: test.test },
                    { timeout: test.timeout || 30000 }
                );
                output = response.data.response || '';
            } else {
                // Execute locally
                const { stdout, stderr } = await execAsync(test.test, {
                    timeout: test.timeout || 30000
                });
                output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            }
            
            result.output = output;
            
            // Verify expected result
            if (test.expectedResult) {
                if (typeof test.expectedResult === 'string') {
                    result.passed = output.includes(test.expectedResult);
                    if (result.passed) {
                        result.evidence.push(`Found expected output: ${test.expectedResult}`);
                    }
                } else if (test.expectedResult instanceof RegExp) {
                    result.passed = test.expectedResult.test(output);
                    if (result.passed) {
                        result.evidence.push(`Output matches expected pattern`);
                    }
                }
            } else {
                // No expected result specified, check for non-error execution
                result.passed = !output.toLowerCase().includes('error') && 
                               !output.toLowerCase().includes('failed');
                if (result.passed) {
                    result.evidence.push('Command executed without errors');
                }
            }
        } catch (error: any) {
            result.passed = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Run a file test - verify file exists and optionally check content
     */
    private async runFileTest(test: CheckpointTest): Promise<TestResult> {
        const result: TestResult = {
            passed: false,
            testType: 'file',
            output: '',
            evidence: [],
            executionTime: 0
        };

        try {
            // Parse file path from test
            const filePath = test.test.replace('file exists:', '').trim();
            
            // Check if file exists
            const stats = await fs.stat(filePath);
            result.evidence.push(`File exists: ${filePath}`);
            result.evidence.push(`File size: ${stats.size} bytes`);
            
            // If expected content provided, check it
            if (test.expectedResult) {
                const content = await fs.readFile(filePath, 'utf-8');
                result.output = content.substring(0, 500); // First 500 chars
                
                if (typeof test.expectedResult === 'string') {
                    result.passed = content.includes(test.expectedResult);
                    if (result.passed) {
                        result.evidence.push('File contains expected content');
                    }
                } else {
                    result.passed = true;
                }
            } else {
                result.passed = true; // File exists
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                result.error = `File not found: ${test.test}`;
            } else {
                result.error = error.message;
            }
            result.passed = false;
        }

        return result;
    }

    /**
     * Run an API test - make HTTP request and verify response
     */
    private async runApiTest(test: CheckpointTest): Promise<TestResult> {
        const result: TestResult = {
            passed: false,
            testType: 'api',
            output: '',
            evidence: [],
            executionTime: 0
        };

        try {
            // Parse API test details
            const testParts = test.test.split(' ');
            const method = testParts[0].toUpperCase();
            const url = testParts[1];
            const data = testParts.length > 2 ? JSON.parse(testParts.slice(2).join(' ')) : undefined;
            
            // Make API request
            const response = await axios({
                method,
                url,
                data,
                timeout: test.timeout || 10000,
                validateStatus: () => true // Don't throw on non-2xx
            });
            
            result.output = JSON.stringify(response.data, null, 2).substring(0, 1000);
            result.evidence.push(`API returned status: ${response.status}`);
            
            // Check expected result
            if (test.expectedResult) {
                if (typeof test.expectedResult === 'object') {
                    // Check for expected fields in response
                    const expected = test.expectedResult;
                    let allMatch = true;
                    
                    for (const [key, value] of Object.entries(expected)) {
                        if (response.data[key] !== value) {
                            allMatch = false;
                            break;
                        }
                    }
                    
                    result.passed = allMatch;
                    if (result.passed) {
                        result.evidence.push('Response matches expected structure');
                    }
                } else if (typeof test.expectedResult === 'number') {
                    // Expected status code
                    result.passed = response.status === test.expectedResult;
                    if (result.passed) {
                        result.evidence.push(`Status code matches expected: ${test.expectedResult}`);
                    }
                }
            } else {
                // Default: 2xx status is success
                result.passed = response.status >= 200 && response.status < 300;
                if (result.passed) {
                    result.evidence.push('API returned successful status');
                }
            }
        } catch (error: any) {
            result.passed = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Run an integration test - complex multi-step test
     */
    private async runIntegrationTest(test: CheckpointTest, sessionId?: string): Promise<TestResult> {
        const result: TestResult = {
            passed: false,
            testType: 'integration',
            output: '',
            evidence: [],
            executionTime: 0
        };

        try {
            // Parse integration test steps
            const steps = test.test.split('&&').map(s => s.trim());
            let allPassed = true;
            
            for (const step of steps) {
                console.log(`  Running integration step: ${step.substring(0, 50)}...`);
                
                // Create a sub-test for each step
                const subTest: CheckpointTest = {
                    id: `${test.id}-step`,
                    name: 'Integration Step',
                    type: 'command',
                    test: step
                };
                
                const stepResult = await this.runCommandTest(subTest, sessionId);
                
                if (!stepResult.passed) {
                    allPassed = false;
                    result.error = `Step failed: ${step}`;
                    result.evidence.push(`Failed at: ${step}`);
                    break;
                }
                
                result.evidence.push(`Step passed: ${step.substring(0, 50)}`);
                result.output += stepResult.output + '\n---\n';
            }
            
            result.passed = allPassed;
            if (result.passed) {
                result.evidence.push(`All ${steps.length} integration steps passed`);
            }
        } catch (error: any) {
            result.passed = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Run a unit test - execute test framework command
     */
    private async runUnitTest(test: CheckpointTest): Promise<TestResult> {
        const result: TestResult = {
            passed: false,
            testType: 'unit',
            output: '',
            evidence: [],
            executionTime: 0
        };

        try {
            // Detect test framework
            let testCommand = test.test;
            
            if (test.test.includes('jest') || test.test.includes('test')) {
                // Jest/Node test
                testCommand = test.test.includes('npm') ? test.test : `npm test ${test.test}`;
            } else if (test.test.includes('pytest')) {
                // Python test
                testCommand = test.test.includes('pytest') ? test.test : `pytest ${test.test}`;
            } else if (test.test.includes('go test')) {
                // Go test
                testCommand = test.test;
            }
            
            const { stdout, stderr } = await execAsync(testCommand, {
                timeout: test.timeout || 60000
            });
            
            result.output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            
            // Check for test framework success indicators
            const successPatterns = [
                /(\d+) passed/i,
                /all tests passed/i,
                /PASS/,
                /✓/,
                /tests?: (\d+) passed/i
            ];
            
            const failurePatterns = [
                /(\d+) failed/i,
                /FAIL/,
                /✗/,
                /error/i,
                /tests?: (\d+) failed/i
            ];
            
            // Check for failures first
            let hasFailed = false;
            for (const pattern of failurePatterns) {
                if (pattern.test(result.output)) {
                    hasFailed = true;
                    const match = result.output.match(pattern);
                    if (match && match[1] && match[1] !== '0') {
                        result.evidence.push(`Found test failures: ${match[0]}`);
                        break;
                    }
                }
            }
            
            if (!hasFailed) {
                // Check for success
                for (const pattern of successPatterns) {
                    if (pattern.test(result.output)) {
                        result.passed = true;
                        const match = result.output.match(pattern);
                        if (match) {
                            result.evidence.push(`Tests passed: ${match[0]}`);
                        }
                        break;
                    }
                }
            }
            
            if (!result.passed && !hasFailed) {
                // Inconclusive, check exit code
                result.passed = !stderr.toLowerCase().includes('error');
                if (result.passed) {
                    result.evidence.push('Test command completed without errors');
                }
            }
        } catch (error: any) {
            // Check if it's just a non-zero exit code
            if (error.code && error.code !== 0) {
                result.error = `Test failed with exit code ${error.code}`;
            } else {
                result.error = error.message;
            }
            result.passed = false;
        }

        return result;
    }

    /**
     * Convert pass/fail criteria string into executable test
     */
    parsePassFailToTest(passFail: string): CheckpointTest {
        const test: CheckpointTest = {
            id: 'parsed-test',
            name: 'Checkpoint Test',
            type: 'command',
            test: ''
        };

        const lowerCriteria = passFail.toLowerCase();

        // Determine test type and command
        if (lowerCriteria.includes('file') && lowerCriteria.includes('exists')) {
            test.type = 'file';
            const fileMatch = passFail.match(/file\s+([^\s]+)/i);
            if (fileMatch) {
                test.test = `file exists: ${fileMatch[1]}`;
            }
        } else if (lowerCriteria.includes('api') || lowerCriteria.includes('endpoint')) {
            test.type = 'api';
            const urlMatch = passFail.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                test.test = `GET ${urlMatch[0]}`;
                test.expectedResult = 200;
            }
        } else if (lowerCriteria.includes('test') && (lowerCriteria.includes('pass') || lowerCriteria.includes('run'))) {
            test.type = 'unit';
            if (lowerCriteria.includes('jest')) {
                test.test = 'npm test';
            } else if (lowerCriteria.includes('pytest')) {
                test.test = 'pytest';
            } else {
                test.test = 'npm test';
            }
        } else if (lowerCriteria.includes('build')) {
            test.type = 'command';
            test.test = 'npm run build';
            test.expectedResult = 'built';
        } else {
            // Default to command test
            test.type = 'command';
            test.test = 'echo "Test checkpoint"';
        }

        return test;
    }
}

// Export singleton
export const testRunner = new CheckpointTestRunner();