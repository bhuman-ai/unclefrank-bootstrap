// FRANK'S WORKING GITHUB-INTEGRATED CLAUDE EXECUTOR
// Uses Claude Code API mode properly - no PTY BS

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'bhuman-ai/unclefrank-bootstrap';
const GITHUB_USER = process.env.GITHUB_USER || 'bhuman-ai';
const GITHUB_EMAIL = process.env.GITHUB_EMAIL || 'frank@unclefrank.ai';

// Session storage
const sessions = new Map();
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/workspace';

// Ensure workspace exists
fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch(console.error);

// Configure git globally
async function configureGit() {
    try {
        await execAsync(`git config --global user.name "${GITHUB_USER}"`);
        await execAsync(`git config --global user.email "${GITHUB_EMAIL}"`);
        if (GITHUB_TOKEN) {
            await execAsync(`git config --global credential.helper store`);
            const credPath = path.join(process.env.HOME || '/root', '.git-credentials');
            await fs.writeFile(credPath, `https://${GITHUB_TOKEN}@github.com\n`, { mode: 0o600 });
        }
        console.log('Git configured successfully');
    } catch (error) {
        console.error('Failed to configure git:', error);
    }
}

configureGit();

// Execute with Claude Code using API mode
async function executeWithClaude(sessionId, message) {
    const session = sessions.get(sessionId);
    const repoPath = session.repoPath;
    
    try {
        // Create a temporary script file with the message
        const scriptPath = path.join(repoPath, '.claude-task.md');
        const fullMessage = `# Task Execution in ${repoPath}

${message}

## Instructions:
1. You are in the directory: ${repoPath}
2. Create actual files using standard file operations
3. Use git commands as needed
4. Report what you've done

Start execution now:`;

        await fs.writeFile(scriptPath, fullMessage);
        
        // Execute Claude with the script file using API mode
        const command = `cd ${repoPath} && claude --dangerously-skip-permissions api "${fullMessage}"`;
        
        console.log(`Executing Claude command for session ${sessionId}`);
        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            timeout: 60000, // 60 second timeout
            cwd: repoPath
        });
        
        // Clean up the script file
        await fs.unlink(scriptPath).catch(() => {});
        
        if (stderr && !stderr.includes('warning')) {
            console.error('Claude stderr:', stderr);
        }
        
        return stdout || 'Command executed';
    } catch (error) {
        console.error('Claude execution error:', error);
        
        // If Claude fails, try direct execution as fallback
        if (message.toLowerCase().includes('create') && message.toLowerCase().includes('file')) {
            return await executeDirectCommand(session, message);
        }
        
        throw error;
    }
}

// Direct command execution for simple file operations
async function executeDirectCommand(session, message) {
    const { repoPath } = session;
    
    try {
        // Parse the message to extract file operations
        const fileMatch = message.match(/(?:file|called|named)\s+([^\s,]+)/i);
        const contentMatch = message.match(/(?:with|containing|that says|console\.log.*?["']([^"']+)["'])/i);
        
        if (fileMatch) {
            const filename = fileMatch[1].replace(/['"]/g, '');
            const content = contentMatch ? contentMatch[1] : `console.log('Created by Uncle Frank');`;
            
            const filePath = path.join(repoPath, filename);
            const fileContent = filename.endsWith('.js') 
                ? `// ${filename} - Created by Uncle Frank's Executor\nconsole.log('${content}');\n`
                : filename.endsWith('.md')
                ? `# ${filename}\n\n${content}\n`
                : `${content}\n`;
            
            await fs.writeFile(filePath, fileContent);
            await execAsync(`cd ${repoPath} && git add ${filename}`);
            
            return `Created file: ${filename} with content:\n${fileContent}`;
        }
        
        return 'Unable to parse file creation request. Please be more specific.';
    } catch (error) {
        console.error('Direct execution error:', error);
        return `Error: ${error.message}`;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        service: 'Uncle Frank Claude Executor',
        version: '3.0-working',
        status: 'operational',
        mode: 'claude-api-mode',
        activeSessions: sessions.size
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessions.size,
        githubConfigured: !!GITHUB_TOKEN
    });
});

// Create session with GitHub repo
app.post('/api/sessions', async (req, res) => {
    const sessionId = uuidv4();
    const workspaceDir = path.join(WORKSPACE_DIR, sessionId);
    const repoPath = path.join(workspaceDir, 'repo');
    
    try {
        await fs.mkdir(workspaceDir, { recursive: true });
        
        // Clone the repository
        console.log(`Cloning ${GITHUB_REPO} to ${repoPath}`);
        await execAsync(`git clone https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git ${repoPath}`);
        
        // Create unique branch
        const branchName = `claude-session-${sessionId}`;
        await execAsync(`cd ${repoPath} && git checkout -b ${branchName}`);
        
        // Initialize session
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'active',
            messages: [],
            files: [],
            branch: branchName,
            repoPath,
            workspaceDir
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            status: 'created',
            branch: branchName,
            repoPath,
            githubUrl: `https://github.com/${GITHUB_REPO}/tree/${branchName}`
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session', details: error.message });
    }
});

// Execute in session
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Store user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        // Execute with Claude or fallback
        let responseContent;
        try {
            // Check if Claude is available
            const { stdout: claudeCheck } = await execAsync('which claude');
            if (claudeCheck.trim()) {
                responseContent = await executeWithClaude(sessionId, message);
            } else {
                throw new Error('Claude not found');
            }
        } catch (error) {
            console.log('Claude not available or failed, using direct execution');
            responseContent = await executeDirectCommand(session, message);
        }
        
        session.messages.push({
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString()
        });
        
        // List files that were created/modified
        try {
            const { stdout } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
            const modifiedFiles = stdout.split('\n').filter(line => line.trim()).map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    status: parts[0],
                    path: parts.slice(1).join(' ')
                };
            });
            session.files = modifiedFiles;
        } catch (error) {
            console.error('Failed to get git status:', error);
            session.files = [];
        }
        
        res.json({
            success: true,
            sessionId,
            status: session.status,
            response: responseContent,
            files: session.files,
            branch: session.branch
        });
    } catch (error) {
        console.error('Execution error:', error);
        session.status = 'error';
        res.status(500).json({ 
            error: 'Execution failed', 
            details: error.message 
        });
    }
});

// Get messages
app.get('/api/sessions/:sessionId/messages', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        messages: session.messages
    });
});

// Get session details
app.get('/api/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const { stdout: gitStatus } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
        
        res.json({
            id: session.id,
            created: session.created,
            status: session.status,
            messageCount: session.messages.length,
            fileCount: session.files.length,
            branch: session.branch,
            gitStatus: gitStatus.trim(),
            lastActivity: session.messages[session.messages.length - 1]?.timestamp
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get session details' });
    }
});

// Get files in session
app.get('/api/sessions/:sessionId/files', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const { stdout } = await execAsync(`cd ${session.repoPath} && find . -type f -name "*.js" -o -name "*.md" -o -name "*.json" | head -20`);
        const files = stdout.split('\n').filter(f => f && !f.includes('node_modules'));
        
        res.json({
            files: session.files,
            allFiles: files
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Commit changes
app.post('/api/sessions/:sessionId/commit', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    const { message = 'Task changes by Claude' } = req.body;
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const { stdout: statusOut } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
        
        if (!statusOut.trim()) {
            return res.json({ message: 'No changes to commit' });
        }
        
        await execAsync(`cd ${session.repoPath} && git add -A && git commit -m "${message}"`);
        
        // Push to remote
        await execAsync(`cd ${session.repoPath} && git push origin ${session.branch}`);
        
        res.json({
            success: true,
            message: 'Changes committed and pushed',
            branch: session.branch,
            githubUrl: `https://github.com/${GITHUB_REPO}/tree/${session.branch}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to commit', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Uncle Frank's WORKING Claude Executor running on port ${PORT}`);
    console.log(`GitHub repo: ${GITHUB_REPO}`);
    console.log(`Using Claude API mode with fallback`);
});