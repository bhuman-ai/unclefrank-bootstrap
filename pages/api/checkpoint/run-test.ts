import { NextApiRequest, NextApiResponse } from 'next';
import { testRunner, CheckpointTest } from '../../../src/api/checkpoint-test-runner';

/**
 * API endpoint to run ACTUAL checkpoint tests
 * Sacred Principle: Execute real tests, not pattern matching
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { 
        checkpoint,
        sessionId,
        passFail
    } = req.body;

    if (!checkpoint && !passFail) {
        return res.status(400).json({ error: 'Checkpoint or passFail criteria required' });
    }

    try {
        console.log(`[Test Runner] Running actual test for checkpoint ${checkpoint?.id || 'parsed'}`);
        
        let test: CheckpointTest;
        
        if (checkpoint && checkpoint.test) {
            // Use provided checkpoint test
            test = {
                id: checkpoint.id,
                name: checkpoint.name,
                type: checkpoint.testType || 'command',
                test: checkpoint.test,
                expectedResult: checkpoint.expectedResult,
                timeout: checkpoint.timeout
            };
        } else if (passFail) {
            // Parse pass/fail criteria into test
            test = testRunner.parsePassFailToTest(passFail);
        } else {
            return res.status(400).json({ error: 'No test specification provided' });
        }
        
        // Run the actual test
        const result = await testRunner.runCheckpointTest(test, sessionId);
        
        // Log result
        console.log(`[Test Runner] Test ${test.name}:`, {
            passed: result.passed,
            type: result.testType,
            executionTime: result.executionTime,
            evidenceCount: result.evidence.length
        });
        
        res.status(200).json({
            success: result.passed,
            testResult: result,
            checkpoint: checkpoint?.id
        });
    } catch (error) {
        console.error('[Test Runner] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Test execution failed'
        });
    }
}