import { NextApiRequest, NextApiResponse } from 'next';
import { claudeHealthChecker } from '../../../src/api/claude-health-checker';

/**
 * REAL Claude validation endpoint
 * Sacred Principle: No fake validation - actually test execution
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { attempt = 1 } = req.body;

    try {
        console.log(`[Claude Validator] Validation attempt ${attempt}`);
        
        // Perform REAL validation
        const validation = await claudeHealthChecker.validateClaudeReady();
        
        if (!validation.ready && attempt < 3) {
            // Attempt auto-fix
            console.log('[Claude Validator] Attempting auto-fix...');
            const fixed = await claudeHealthChecker.attemptAutoFix();
            
            if (fixed) {
                // Re-validate after fix
                const revalidation = await claudeHealthChecker.validateClaudeReady();
                return res.status(200).json(revalidation);
            }
        }
        
        res.status(200).json(validation);
    } catch (error) {
        console.error('[Claude Validator] Error:', error);
        res.status(500).json({
            ready: false,
            details: {
                error: error.message || 'Validation failed',
                attempt
            }
        });
    }
}