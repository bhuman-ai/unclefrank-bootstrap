// FRANK'S GITHUB-INTEGRATED CLAUDE EXECUTOR (API VERSION)
// Uses Anthropic API with actual file operations
// No more "describing" - real file creation and git operations!

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

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

// Execute task with Anthropic API and real file operations
async function executeWithAnthropicAPI(session, message) {
    const { repoPath } = session;
    
    // Create a tool-use enabled prompt
    const toolPrompt = `You are Uncle Frank's GitHub-integrated task executor.
You are working in a git repository at: ${repoPath}
You have full access to create, modify, and delete files.
You can execute git commands.

IMPORTANT: You MUST use the provided tools to create actual files and execute commands.
Do NOT just describe what you would do - actually DO IT using the tools.

Available tools:
- create_file: Create a new file with content
- edit_file: Edit an existing file
- delete_file: Delete a file
- run_command: Execute shell commands (including git)
- list_files: List files in a directory

Current task: ${message}`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 4096,
            messages: [{ role: 'user', content: toolPrompt }],
            tools: [
                {
                    name: 'create_file',
                    description: 'Create a new file with specified content',
                    input_schema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Relative path from repo root' },
                            content: { type: 'string', description: 'File content' }
                        },
                        required: ['path', 'content']
                    }
                },
                {
                    name: 'edit_file',
                    description: 'Edit an existing file',
                    input_schema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Relative path from repo root' },
                            content: { type: 'string', description: 'New file content' }
                        },
                        required: ['path', 'content']
                    }
                },
                {
                    name: 'delete_file',
                    description: 'Delete a file',
                    input_schema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Relative path from repo root' }
                        },
                        required: ['path']
                    }
                },
                {
                    name: 'run_command',
                    description: 'Execute a shell command',
                    input_schema: {
                        type: 'object',
                        properties: {
                            command: { type: 'string', description: 'Shell command to execute' }
                        },
                        required: ['command']
                    }
                },
                {
                    name: 'list_files',
                    description: 'List files in a directory',
                    input_schema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Directory path (default: .)' }
                        }
                    }
                }
            ]
        });

        // Process tool calls
        let output = '';
        if (response.content[0].type === 'tool_use') {
            for (const toolCall of response.content) {
                if (toolCall.type !== 'tool_use') continue;
                
                const result = await executeToolCall(repoPath, toolCall);
                output += `\n${toolCall.name}: ${result}`;
            }
        }
        
        // Get the assistant's response
        const textContent = response.content.find(c => c.type === 'text');
        if (textContent) {
            output = textContent.text + '\n\nOperations performed:' + output;
        }
        
        return output;
    } catch (error) {
        console.error('Anthropic API error:', error);
        throw error;
    }
}

// Execute tool calls
async function executeToolCall(repoPath, toolCall) {
    const { name, input } = toolCall;
    
    try {
        switch (name) {
            case 'create_file': {
                const filePath = path.join(repoPath, input.path);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, input.content);
                await execAsync(`cd ${repoPath} && git add ${input.path}`);
                return `Created ${input.path}`;
            }
            
            case 'edit_file': {
                const filePath = path.join(repoPath, input.path);
                await fs.writeFile(filePath, input.content);
                await execAsync(`cd ${repoPath} && git add ${input.path}`);
                return `Updated ${input.path}`;
            }
            
            case 'delete_file': {
                const filePath = path.join(repoPath, input.path);
                await fs.unlink(filePath);
                await execAsync(`cd ${repoPath} && git add -A`);
                return `Deleted ${input.path}`;
            }
            
            case 'run_command': {
                const { stdout, stderr } = await execAsync(`cd ${repoPath} && ${input.command}`);
                return stdout || stderr || 'Command executed successfully';
            }
            
            case 'list_files': {
                const dirPath = path.join(repoPath, input.path || '.');
                const files = await fs.readdir(dirPath);
                return files.join('\n');
            }
            
            default:
                return `Unknown tool: ${name}`;
        }
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Uncle Frank GitHub-Integrated Claude Executor (API Version)',
        version: '4.0.0',
        features: [
            'Anthropic API with tool use',
            'Real file creation and modification',
            'Git operations (clone, commit, push)',
            'Branch management',
            'Full repository access'
        ],
        sessions: sessions.size,
        githubConfigured: !!GITHUB_TOKEN,
        apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessions.size,
        githubConfigured: !!GITHUB_TOKEN,
        apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY
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
            systemPrompt: req.body.systemPrompt || `You are Uncle Frank's GitHub-integrated task executor.`
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
        
        // Execute with Anthropic API
        const responseContent = await executeWithAnthropicAPI(session, message);
        
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
    console.log(`🚀 Uncle Frank GitHub-Integrated Claude Executor (API Version) running on port ${PORT}`);
    console.log(`📍 GitHub repo: ${GITHUB_REPO}`);
    console.log(`🔑 GitHub token: ${GITHUB_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log(`🤖 Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`💾 Workspace directory: ${WORKSPACE_DIR}`);
});