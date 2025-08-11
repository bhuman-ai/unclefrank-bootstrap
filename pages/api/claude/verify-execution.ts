import { NextApiRequest, NextApiResponse } from 'next';
import { executionVerifier, CommandExpectation } from '../../../cli/src/api/claude-execution-verifier';

/**
 * API endpoint to verify Claude actually executed commands
 * Sacred Principle: Trust but verify - check the work was done
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { 
        sessionId, 
        command, 
        expectedPatterns = [],
        requiredFiles = [],
        expectedChanges = [],
        checkpointId,
        passFail
    } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }

    try {
        console.log(`[Execution Verifier] Verifying execution for session ${sessionId}`);
        
        let result;
        
        if (checkpointId && passFail) {
            // Verify checkpoint execution
            result = await executionVerifier.verifyCheckpointExecution(
                sessionId,
                checkpointId,
                passFail
            );
        } else {
            // Build expectation from request
            const expectation: CommandExpectation = {
                command: command || '',
                expectedPatterns: expectedPatterns.map((p: string) => new RegExp(p, 'i')),
                requiredFiles,
                expectedChanges,
                timeout: 10000
            };
            
            // Verify general command execution
            result = await executionVerifier.verifyExecution(sessionId, expectation);
        }
        
        // Log the result for debugging
        console.log(`[Execution Verifier] Result:`, {
            executed: result.executed,
            confidence: result.confidence,
            evidenceCount: result.evidence.length,
            errorCount: result.errors.length
        });
        
        res.status(200).json({
            success: result.executed,
            result
        });
    } catch (error) {
        console.error('[Execution Verifier] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Verification failed'
        });
    }
}