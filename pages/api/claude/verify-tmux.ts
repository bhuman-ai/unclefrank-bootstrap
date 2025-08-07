import { NextApiRequest, NextApiResponse } from 'next';
import { tmuxVerifier } from '../../../src/api/tmux-command-verifier';

/**
 * API endpoint to verify tmux commands actually executed
 * Sacred Principle: Don't trust tmux exit codes - verify execution
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'POST') {
        const { 
            sessionName = 'claude-manual',
            windowName = 0,
            command
        } = req.body;

        try {
            console.log(`[Tmux Verifier] Verifying command execution in ${sessionName}:${windowName}`);
            
            const result = await tmuxVerifier.verifyTmuxExecution(
                sessionName,
                windowName,
                command
            );
            
            res.status(200).json({
                success: result.executed,
                ...result
            });
        } catch (error) {
            console.error('[Tmux Verifier] Error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Verification failed'
            });
        }
    } else if (req.method === 'GET') {
        // Health check endpoint
        const { sessionName = 'claude-manual' } = req.query;
        
        try {
            const health = await tmuxVerifier.monitorSessionHealth(sessionName as string);
            
            res.status(200).json({
                success: health.healthy,
                ...health
            });
        } catch (error) {
            console.error('[Tmux Verifier] Health check error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Health check failed'
            });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}