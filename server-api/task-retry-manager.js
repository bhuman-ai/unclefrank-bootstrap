// TASK RETRY MANAGER - Handles retries for failed tasks
// Implements exponential backoff and circuit breaker pattern

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

// Track retry state
const retryState = new Map();
const circuitBreakers = new Map();

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'retry':
                return await retryTask(req, res);
            case 'status':
                return await getRetryStatus(req, res);
            case 'reset':
                return await resetRetry(req, res);
            case 'circuit-status':
                return await getCircuitStatus(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Retry Manager error:', error);
        return res.status(500).json({ 
            error: 'Retry operation failed',
            details: error.message 
        });
    }
};

// Retry a failed task
async function retryTask(req, res) {
    const { taskId, taskFunction, payload } = req.body;
    
    if (!taskId || !taskFunction) {
        return res.status(400).json({ error: 'Missing taskId or taskFunction' });
    }
    
    // Check circuit breaker
    const circuit = getCircuitBreaker(taskFunction);
    if (circuit.state === 'open') {
        if (Date.now() - circuit.openedAt < CIRCUIT_BREAKER_TIMEOUT) {
            return res.status(503).json({
                error: 'Circuit breaker open',
                message: `Too many failures for ${taskFunction}. Retry after ${new Date(circuit.openedAt + CIRCUIT_BREAKER_TIMEOUT).toISOString()}`,
                retryAfter: Math.ceil((circuit.openedAt + CIRCUIT_BREAKER_TIMEOUT - Date.now()) / 1000)
            });
        } else {
            // Try to close the circuit
            circuit.state = 'half-open';
        }
    }
    
    // Get or create retry state
    let state = retryState.get(taskId) || {
        taskId,
        attempts: 0,
        lastAttempt: null,
        lastError: null,
        status: 'pending'
    };
    
    // Check max retries
    if (state.attempts >= MAX_RETRIES) {
        return res.status(400).json({
            error: 'Max retries exceeded',
            attempts: state.attempts,
            lastError: state.lastError,
            suggestion: 'Manual intervention required'
        });
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(INITIAL_DELAY * Math.pow(2, state.attempts), MAX_DELAY);
    
    // Wait before retry
    if (state.lastAttempt) {
        const timeSinceLastAttempt = Date.now() - state.lastAttempt;
        if (timeSinceLastAttempt < delay) {
            return res.status(429).json({
                error: 'Too soon to retry',
                retryAfter: Math.ceil((delay - timeSinceLastAttempt) / 1000),
                nextRetryAt: new Date(state.lastAttempt + delay).toISOString()
            });
        }
    }
    
    // Update state
    state.attempts++;
    state.lastAttempt = Date.now();
    state.status = 'retrying';
    retryState.set(taskId, state);
    
    try {
        // Execute the task
        const result = await executeTaskWithTimeout(taskFunction, payload);
        
        // Success - update state
        state.status = 'success';
        state.result = result;
        retryState.set(taskId, state);
        
        // Update circuit breaker
        if (circuit.state === 'half-open') {
            circuit.state = 'closed';
            circuit.consecutiveFailures = 0;
        }
        
        return res.status(200).json({
            success: true,
            taskId,
            attempts: state.attempts,
            result,
            message: `Task succeeded after ${state.attempts} attempt(s)`
        });
        
    } catch (error) {
        // Failure - update state
        state.status = 'failed';
        state.lastError = error.message;
        retryState.set(taskId, state);
        
        // Update circuit breaker
        circuit.consecutiveFailures++;
        if (circuit.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            circuit.state = 'open';
            circuit.openedAt = Date.now();
        }
        
        // Determine if we should retry automatically
        const shouldRetry = state.attempts < MAX_RETRIES && circuit.state !== 'open';
        
        return res.status(shouldRetry ? 503 : 500).json({
            success: false,
            taskId,
            attempts: state.attempts,
            remainingRetries: MAX_RETRIES - state.attempts,
            error: error.message,
            shouldRetry,
            nextRetryDelay: shouldRetry ? Math.min(INITIAL_DELAY * Math.pow(2, state.attempts), MAX_DELAY) / 1000 : null,
            circuitBreakerStatus: circuit.state
        });
    }
}

// Execute task with timeout
async function executeTaskWithTimeout(taskFunction, payload, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Task execution timeout'));
        }, timeout);
        
        try {
            // Map task function to actual implementation
            let result;
            
            switch (taskFunction) {
                case 'claude-execute':
                    result = await executeClaudeTask(payload);
                    break;
                case 'github-create-issue':
                    result = await createGitHubIssue(payload);
                    break;
                case 'validate-draft':
                    result = await validateDraft(payload);
                    break;
                default:
                    throw new Error(`Unknown task function: ${taskFunction}`);
            }
            
            clearTimeout(timer);
            resolve(result);
        } catch (error) {
            clearTimeout(timer);
            reject(error);
        }
    });
}

// Task implementations (these would call actual APIs)
async function executeClaudeTask(payload) {
    const response = await fetch(`${process.env.CLAUDE_EXECUTOR_URL || 'https://uncle-frank-claude.fly.dev'}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`Claude execution failed: ${response.status}`);
    }
    
    return response.json();
}

async function createGitHubIssue(payload) {
    // Simulate GitHub API call
    if (!process.env.GITHUB_TOKEN) {
        throw new Error('GitHub token not configured');
    }
    
    // In real implementation, call GitHub API
    return { issueNumber: Math.floor(Math.random() * 1000), url: 'https://github.com/...' };
}

async function validateDraft(payload) {
    // Simulate validation
    return { valid: true, issues: [] };
}

// Get retry status
async function getRetryStatus(req, res) {
    const { taskId } = req.query;
    
    if (!taskId) {
        // Return all retry states
        const states = Array.from(retryState.entries()).map(([id, state]) => ({
            taskId: id,
            ...state
        }));
        
        return res.status(200).json({
            total: states.length,
            states
        });
    }
    
    const state = retryState.get(taskId);
    if (!state) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    return res.status(200).json(state);
}

// Reset retry state
async function resetRetry(req, res) {
    const { taskId } = req.body;
    
    if (taskId) {
        retryState.delete(taskId);
        return res.status(200).json({
            success: true,
            message: `Reset retry state for task ${taskId}`
        });
    } else {
        // Reset all
        retryState.clear();
        circuitBreakers.clear();
        return res.status(200).json({
            success: true,
            message: 'Reset all retry states and circuit breakers'
        });
    }
}

// Get circuit breaker status
async function getCircuitStatus(req, res) {
    const breakers = Array.from(circuitBreakers.entries()).map(([name, breaker]) => ({
        function: name,
        ...breaker,
        timeUntilClose: breaker.state === 'open' ? 
            Math.max(0, breaker.openedAt + CIRCUIT_BREAKER_TIMEOUT - Date.now()) / 1000 : 
            null
    }));
    
    return res.status(200).json({
        circuitBreakers: breakers,
        threshold: CIRCUIT_BREAKER_THRESHOLD,
        timeout: CIRCUIT_BREAKER_TIMEOUT / 1000
    });
}

// Get or create circuit breaker
function getCircuitBreaker(functionName) {
    if (!circuitBreakers.has(functionName)) {
        circuitBreakers.set(functionName, {
            state: 'closed', // closed, open, half-open
            consecutiveFailures: 0,
            openedAt: null
        });
    }
    return circuitBreakers.get(functionName);
}