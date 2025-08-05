// FRANK'S GITHUB-INTEGRATED CLAUDE EXECUTOR
// Uses Claude Code CLI with full GitHub integration
// No more "describing" - actual file creation and git operations!

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
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
            // Store credentials
            const credPath = path.join(process.env.HOME || '/root', '.git-credentials');
            await fs.writeFile(credPath, `https://${GITHUB_TOKEN}@github.com\n`, { mode: 0o600 });
        }
        console.log('Git configured successfully');
    } catch (error) {
        console.error('Failed to configure git:', error);
    }
}

// Initialize git configuration on startup
configureGit();

// Execute with Claude Code CLI in a git repository
async function executeWithClaudeInRepo(sessionId, message) {
    const session = sessions.get(sessionId);
    const repoPath = session.repoPath;
    
    console.log(`[Claude] Starting execution in ${repoPath}`);
    
    return new Promise((resolve, reject) => {
        // Change to repo directory and run Claude with permissions flag
        const command = `cd ${repoPath} && claude --dangerously-skip-permissions chat`;
        console.log(`[Claude] Running command: ${command}`);
        
        const claudeProcess = spawn('bash', ['-c', command], {
            env: { ...process.env, HOME: '/root' }
        });
        
        let output = '';
        let error = '';
        
        claudeProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        claudeProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        claudeProcess.on('close', (code) => {
            if (code !== 0 && error) {
                reject(new Error(`Claude exited with code ${code}: ${error}`));
            } else {
                resolve(output);
            }
        });
        
        // Send the message with file system context
        const enhancedMessage = `${message}

IMPORTANT: You are in a git repository at ${repoPath}
- Create actual files using standard commands
- Use git commands to track changes
- The repository is already cloned and ready
- You have full file system access`;
        
        claudeProcess.stdin.write(enhancedMessage + '\n');
        claudeProcess.stdin.end();
    });
}

// Routes
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Uncle Frank GitHub-Integrated Claude Executor',
        version: '3.0.0',
        features: [
            'Claude Code CLI with GitHub integration',
            'Real file creation and modification',
            'Git operations (clone, commit, push)',
            'Branch management',
            'Full repository access'
        ],
        sessions: sessions.size,
        githubConfigured: !!GITHUB_TOKEN
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
    try {
        const sessionId = uuidv4();
        const sessionPath = path.join(WORKSPACE_DIR, sessionId);
        const repoPath = path.join(sessionPath, 'repo');
        
        await fs.mkdir(sessionPath, { recursive: true });
        
        // Clone the repository
        console.log(`Cloning ${GITHUB_REPO} into ${repoPath}...`);
        const cloneUrl = GITHUB_TOKEN 
            ? `https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git`
            : `https://github.com/${GITHUB_REPO}.git`;
            
        await execAsync(`git clone ${cloneUrl} ${repoPath}`);
        
        // Create a new branch for this session
        const branchName = `claude-session-${sessionId}`;
        await execAsync(`cd ${repoPath} && git checkout -b ${branchName}`);
        
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            status: 'active',
            messages: [],
            files: [],
            projectPath: sessionPath,
            repoPath: repoPath,
            branch: branchName,
            systemPrompt: req.body.systemPrompt || `You are Uncle Frank's GitHub-integrated task executor.
You have full access to the git repository and file system.
Create real files, make real commits, push real changes.
No placeholders, no "would" statements - DO IT.`
        };
        
        sessions.set(sessionId, session);
        
        res.json({
            sessionId,
            repoPath,
            branch: branchName,
            githubUrl: `https://github.com/${GITHUB_REPO}/tree/${branchName}`
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create session', 
            details: error.message 
        });
    }
});

// Execute task in repo
app.post('/api/sessions/:sessionId/execute', async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        session.status = 'executing';
        
        // Add user message
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        let responseContent;
        
        // Check if Claude Code is available and log the result
        let claudeAvailable = false;
        try {
            const { stdout } = await execAsync('which claude');
            console.log('Claude Code found at:', stdout.trim());
            claudeAvailable = true;
        } catch (error) {
            console.error('Claude Code not found:', error.message);
        }
        
        if (claudeAvailable) {
            try {
                // Execute with real Claude Code in the repo
                console.log('Executing with Claude Code CLI...');
                responseContent = await executeWithClaudeInRepo(sessionId, message);
            } catch (error) {
                console.error('Claude execution failed:', error);
                // Fallback if Claude execution fails
                responseContent = `Claude execution failed: ${error.message}`;
            }
        } else {
            // Fallback: execute git and file operations directly
            console.log('Claude Code not available, executing directly...');
            responseContent = await executeDirectly(session, message);
        }
        
        session.messages.push({
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString()
        });
        
        // List files that were created/modified
        const { stdout } = await execAsync(`cd ${session.repoPath} && git status --porcelain`);
        const modifiedFiles = stdout.split('\n').filter(line => line.trim()).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                status: parts[0],
                path: parts.slice(1).join(' ')
            };
        });
        
        session.files = modifiedFiles;
        
        // Update status
        const isComplete = responseContent.toLowerCase().includes('complete') ||
                          responseContent.toLowerCase().includes('done') ||
                          responseContent.toLowerCase().includes('finished');
        
        session.status = isComplete ? 'completed' : 'active';
        
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

// Direct execution fallback (when Claude Code isn't available)
async function executeDirectly(session, message) {
    const { repoPath } = session;
    
    // Parse the message to understand what needs to be done
    // This is a simplified version - in production, you'd use an LLM to parse
    
    if (message.toLowerCase().includes('create') && message.toLowerCase().includes('file')) {
        // Better filename extraction - look for quoted strings or filenames with extensions
        let filename = 'example.js';
        
        // Try to extract filename from various patterns
        const patterns = [
            /"([^"]+\.\w+)"/,                    // "filename.ext" in quotes
            /'([^']+\.\w+)'/,                    // 'filename.ext' in quotes
            /(?:file|called|named)\s+([^\s,]+\.\w+)/i,  // file named something.ext
            /([a-zA-Z0-9_-]+\.\w+)/              // any filename.ext pattern
        ];
        
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                filename = match[1];
                break;
            }
        }
        
        // Create a simple file
        const filePath = path.join(repoPath, filename);
        const content = `// Created by Uncle Frank's executor
// Task: ${message}
console.log("Hello from ${filename}");
`;
        await fs.writeFile(filePath, content);
        await execAsync(`cd ${repoPath} && git add ${filename}`);
        
        return `Created file: ${filename}`;
    }
    
    return 'Direct execution not fully implemented. Please ensure Claude Code is installed.';
}

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

// Get session details with git status
app.get('/api/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        // Get git status
        const { stdout: status } = await execAsync(`cd ${session.repoPath} && git status --short`);
        const { stdout: branch } = await execAsync(`cd ${session.repoPath} && git branch --show-current`);
        
        res.json({
            id: session.id,
            created: session.created,
            status: session.status,
            messageCount: session.messages.length,
            fileCount: session.files.length,
            branch: branch.trim(),
            gitStatus: status.trim(),
            lastActivity: session.messages[session.messages.length - 1]?.timestamp
        });
    } catch (error) {
        res.json({
            id: session.id,
            created: session.created,
            status: session.status,
            messageCount: session.messages.length,
            fileCount: session.files.length,
            error: error.message
        });
    }
});

// Commit and push changes
app.post('/api/sessions/:sessionId/commit', async (req, res) => {
    const { sessionId } = req.params;
    const { message = 'Updates from Claude session' } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const { repoPath, branch } = session;
        
        // Check if there are changes
        const { stdout: status } = await execAsync(`cd ${repoPath} && git status --porcelain`);
        if (!status.trim()) {
            return res.json({ 
                success: true, 
                message: 'No changes to commit' 
            });
        }
        
        // Commit all changes
        await execAsync(`cd ${repoPath} && git add -A`);
        await execAsync(`cd ${repoPath} && git commit -m "${message}"`);
        
        // Push to remote
        if (GITHUB_TOKEN) {
            await execAsync(`cd ${repoPath} && git push origin ${branch}`);
            
            return res.json({
                success: true,
                message: 'Changes committed and pushed',
                branch,
                githubUrl: `https://github.com/${GITHUB_REPO}/tree/${branch}`
            });
        } else {
            return res.json({
                success: true,
                message: 'Changes committed locally (no GitHub token for push)',
                branch
            });
        }
    } catch (error) {
        console.error('Commit error:', error);
        res.status(500).json({ 
            error: 'Commit failed', 
            details: error.message 
        });
    }
});

// List files in the repository
app.get('/api/sessions/:sessionId/files', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
        const { repoPath } = session;
        
        // Get list of files from git
        const { stdout } = await execAsync(`cd ${repoPath} && git ls-files`);
        const files = stdout.trim().split('\n').filter(f => f);
        
        // Get modified files
        const { stdout: modified } = await execAsync(`cd ${repoPath} && git status --porcelain`);
        const modifiedFiles = modified.trim().split('\n')
            .filter(line => line)
            .map(line => ({
                status: line.substring(0, 2).trim(),
                path: line.substring(3)
            }));
        
        res.json({
            files,
            modified: modifiedFiles,
            total: files.length
        });
    } catch (error) {
        console.error('File listing error:', error);
        res.status(500).json({ 
            error: 'Failed to list files', 
            details: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Uncle Frank GitHub-Integrated Claude Executor running on port ${PORT}`);
    console.log(`📍 GitHub repo: ${GITHUB_REPO}`);
    console.log(`🔑 GitHub token: ${GITHUB_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log(`💾 Workspace directory: ${WORKSPACE_DIR}`);
});