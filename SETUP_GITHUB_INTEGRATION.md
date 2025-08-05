# Setting Up GitHub Integration for Claude Executor

## Why GitHub Integration?

Currently, Claude is just describing what it would do instead of actually creating files. With GitHub integration:
- Claude clones your actual repository
- Creates real files in the file system
- Makes real commits
- Pushes changes to GitHub branches
- You can create PRs from the changes

## Setup Steps

### 1. Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "Claude Executor"
4. Select these permissions:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again)

### 2. Deploy GitHub-Integrated Version

```bash
cd /Users/don/UncleFrank/unclefrank-bootstrap/claude-fly-deployment

# Set your GitHub token
export GITHUB_TOKEN="your-token-here"

# Run the deployment script
chmod +x deploy-github-integrated.sh
./deploy-github-integrated.sh
```

### 3. Update Vercel Integration

Replace the current integration with the GitHub version:

```bash
cd /Users/don/UncleFrank/unclefrank-bootstrap

# Copy the new integration
cp api/claude-executor-integration-github.js api/claude-executor-integration.js

# Deploy to Vercel
vercel --prod
```

### 4. Test GitHub Integration

```bash
# Test creating a session (will clone repo)
curl -X POST https://uncle-frank-claude.fly.dev/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"systemPrompt": "Create real files!"}'

# Should return:
# {
#   "sessionId": "...",
#   "branch": "claude-session-...",
#   "githubUrl": "https://github.com/bhuman-ai/unclefrank-bootstrap/tree/claude-session-..."
# }
```

## How It Works

1. **Session Creation**: 
   - Clones the repository
   - Creates a new branch for the session
   - Sets up git configuration

2. **Task Execution**:
   - Claude runs in the actual repository
   - Creates real files with real content
   - Uses git commands to track changes

3. **Completion**:
   - Commits all changes
   - Pushes to the session branch
   - Ready for PR creation

## Testing Full Flow

```javascript
// test-github-integration.js
const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';

async function test() {
  // 1. Create session
  const sessionRes = await fetch(`${CLAUDE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  const { sessionId, branch } = await sessionRes.json();
  console.log(`Created session ${sessionId} on branch ${branch}`);
  
  // 2. Execute task
  const executeRes = await fetch(`${CLAUDE_URL}/api/sessions/${sessionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Create a file called hello.js that prints "Hello from Claude"'
    })
  });
  
  const result = await executeRes.json();
  console.log('Execution result:', result);
  
  // 3. Check files
  const filesRes = await fetch(`${CLAUDE_URL}/api/sessions/${sessionId}/files`);
  const files = await filesRes.json();
  console.log('Files created:', files);
  
  // 4. Commit changes
  const commitRes = await fetch(`${CLAUDE_URL}/api/sessions/${sessionId}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Created hello.js file'
    })
  });
  
  const commit = await commitRes.json();
  console.log('Commit result:', commit);
}

test();
```

## Benefits

1. **Real File Creation**: No more "I would create..." - actual files appear
2. **Version Control**: Every change is tracked in git
3. **Branch Isolation**: Each session gets its own branch
4. **PR Workflow**: Changes can be reviewed before merging
5. **Full Traceability**: See exactly what Claude did

## Troubleshooting

### "Permission denied" errors
- Make sure your GitHub token has `repo` permissions
- Check that the token is set correctly in Fly.io secrets

### "Repository not found"
- Verify the GITHUB_REPO setting matches your repo
- Ensure the token has access to the repository

### Files not being created
- Check Claude Code is installed on the server
- Verify git is configured correctly
- Look at the Fly.io logs: `fly logs -a uncle-frank-claude`