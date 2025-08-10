# Technical.md — Current System Architecture

## Deployed Infrastructure

### Fly.io Server (uncle-frank-claude.fly.dev)
**Status**: ✅ Deployed and Running

#### Components
- **Base**: Ubuntu with Node.js 20
- **Process Manager**: PM2 with ecosystem.config.js
- **Session Manager**: tmux with custom config
- **Queue System**: File-based command queue at `/app/command-queue/`
- **Claude CLI**: Installed globally via npm

#### Key Files
- `server-queue.js` - Main Express server
- `tmux-injector.sh` - Monitors queue and injects commands
- `Dockerfile` - Container configuration
- `fly.toml` - Fly.io deployment config

#### How It Works
1. Client sends request to create session
2. Server clones GitHub repo for session
3. Commands queued as files in `/app/command-queue/`
4. `tmux-injector.sh` polls queue every 2 seconds
5. Commands injected into tmux pane
6. Output captured and returned to client

### Vercel Functions (unclefrank-bootstrap.vercel.app)
**Status**: ✅ Auto-deploying from GitHub

#### Active Endpoints
- `/api/github.js` - GitHub API wrapper
- `/api/approve-task.js` - PR approval and merging
- `/api/frank.js` - Frank chat responses

#### Inactive But Deployed
- `/api/project-draft-manager.js` - Not integrated
- `/api/checkpoint-decomposer.js` - Not integrated
- `/api/task-instance-manager.js` - Not integrated
- `/api/system-agents.js` - Not integrated
- `/api/helper-agents.js` - Not integrated

## Data Flow (Current)

```
User Input (UI)
    ↓
GitHub Issue Created
    ↓
Claude Session Created (Fly.io)
    ↓
Commands Executed via tmux
    ↓
Output Streamed to UI
    ↓
Code Pushed to GitHub Branch
    ↓
PR Created
    ↓
Vercel Preview Generated
    ↓
Human Review
    ↓
PR Merged to Main
```

## Authentication & Secrets

### GitHub Token
- Required for: Issue creation, PR management, code push
- Scope needed: `repo` (full control)
- Used by: Both Fly.io and Vercel

### Anthropic API Key
- Required for: Claude API calls (Frank chat, future agents)
- Not used for: Claude CLI (uses manual auth)
- Used by: Vercel functions only

### Claude Manual Auth
- **Problem**: Resets on each Fly.io deployment
- **Current Solution**: Manual setup after deploy
- **Process**:
  1. SSH into Fly.io: `fly ssh console`
  2. Run: `tmux attach -t claude-manual`
  3. Authenticate Claude manually
  4. Detach: `Ctrl+B, D`

## Session Management

### Claude Sessions
- Stored in: `/persistent/sessions.json`
- Format:
```json
{
  "session-id": {
    "id": "uuid",
    "created": "ISO-8601",
    "status": "ready|processing|completed|error",
    "messages": [],
    "branch": "claude-session-xxx",
    "repoPath": "/app/sessions/xxx/repo"
  }
}
```

### GitHub Integration
- Each session creates a unique branch
- Commits are made automatically
- PRs must be created via API call
- Labels used: `task`, `claude`, `ready-for-review`

## Technical Limitations

### Current Bottlenecks
1. **Single Claude Session**: Only one `claude-manual` tmux session
2. **No Concurrency**: Tasks execute sequentially
3. **Manual Auth**: Requires human intervention after deploy
4. **No Persistence**: Claude conversation resets between tasks
5. **Output Parsing**: Regex-based, fragile

### API Rate Limits
- GitHub: 5000 requests/hour (authenticated)
- Anthropic: Based on tier (usually 1000/min)
- Vercel: 100 serverless function invocations/hour (free)

### Infrastructure Limits
- Fly.io: 1 shared CPU, 256MB RAM (free tier)
- Vercel: 10 second timeout for functions
- GitHub Actions: Not currently used

## Monitoring & Logs

### Available Logs
- Fly.io: `fly logs -a uncle-frank-claude`
- Vercel: Function logs in dashboard
- PM2: `fly ssh console` then `pm2 logs`
- tmux: Captured in session output

### Health Checks
- Fly.io: `GET /health` endpoint
- Vercel: Automatic function monitoring
- Claude Session: `GET /api/sessions/:id/status`

## Deployment Process

### Fly.io Deployment
```bash
cd claude-fly-deployment
fly deploy
# Then manually setup Claude auth
```

### Vercel Deployment
```bash
git push origin master
# Auto-deploys via GitHub integration
```

## Error Recovery

### Current Manual Processes
1. **Claude Session Hung**: 
   - SSH to Fly.io
   - Kill tmux session
   - Restart PM2

2. **GitHub API Errors**:
   - Check token validity
   - Verify permissions
   - Retry manually

3. **Vercel Function Timeout**:
   - Check logs
   - Reduce payload size
   - Retry request

## Security Considerations

### Current Security Model
- GitHub tokens stored as env vars
- No user authentication on UI
- All repos accessible via GitHub token
- Claude has full system access on Fly.io
- No audit logging

### Recommendations (Not Implemented)
- Add user authentication
- Implement audit logging
- Use GitHub Apps instead of PAT
- Sandbox Claude execution
- Add rate limiting

---

*This document reflects the current technical implementation.*
*Planned architecture improvements are in `/docs to work towards/technical.md`*