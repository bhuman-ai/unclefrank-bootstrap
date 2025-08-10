# Project.md — Current Production State

## Overview
Uncle Frank's Task Execution System - A Claude-powered task runner deployed on Fly.io that executes development tasks through GitHub integration.

## What's Actually Working Now

### 1. Claude Execution on Fly.io ✅
- **Server**: uncle-frank-claude.fly.dev
- **Features**:
  - Persistent tmux sessions with Claude
  - Queue-based command injection via `/app/command-queue/`
  - Session persistence in `/persistent/sessions.json`
  - Real-time terminal output streaming
  - Manual Claude authentication (requires setup after deploy)

### 2. GitHub Integration ✅
- **Working Features**:
  - Create issues for tasks
  - Update issue status with labels
  - Create branches for Claude sessions
  - Push code changes
  - Create PRs (manual review required)
  - Get Vercel preview URLs from PR comments

### 3. Task Execution UI ✅
- **URL**: https://unclefrank-bootstrap.vercel.app
- **Working Features**:
  - Create tasks from UI
  - Execute tasks via Claude on Fly.io
  - View real-time terminal output
  - Mark tasks ready for human review
  - Display Vercel preview URLs
  - Approve tasks to merge PRs

### 4. Frank Chat Assistant ✅
- **URL**: /frank-chat.html
- **Features**:
  - Chat interface with Claude API
  - Brooklyn personality responses
  - Mobile-friendly design
  - System status checking

## Current API Endpoints (Deployed & Working)

### Fly.io Server Endpoints
- `POST /api/sessions` - Create new Claude session
- `POST /api/sessions/:id/execute` - Execute command in session
- `GET /api/sessions/:id/status` - Get session status
- `GET /api/sessions/:id/terminal` - Stream terminal output
- `GET /api/sessions/:id/messages` - Get session messages

### Vercel API Endpoints
- `/api/github.js` - GitHub operations (issues, PRs)
- `/api/approve-task.js` - Approve and merge PRs
- `/api/frank.js` - Frank chat backend

## Current Limitations

### What's NOT Working Yet
1. Automatic checkpoint generation (hardcoded fallbacks only)
2. Draft validation system (APIs created but not integrated)
3. Task Instance Dashboard UI (backend exists, no frontend)
4. System/Helper agents (code exists but not wired up)
5. Automatic retry and escalation (manual intervention required)
6. Cross-document validation
7. Dependency analysis
8. Parallel execution

### Known Issues
1. Claude session requires manual auth after each Fly.io deploy
2. No automatic error recovery
3. Terminal output can be truncated for long responses
4. PR merging requires GitHub token with write access
5. Vercel preview URL detection is fragile

## How to Use What's Working

### Creating and Executing a Task
1. Go to https://unclefrank-bootstrap.vercel.app
2. Enter task description in the UI
3. Click "Execute Checkpoints"
4. Wait for Claude to complete execution
5. Review terminal output
6. Click "Refresh from Claude Sessions" to update status
7. When ready, review the Vercel preview URL
8. Click "Approve" to merge to main

### Using Frank Chat
1. Navigate to /frank-chat.html
2. Type your question or request
3. Frank will respond with direct, actionable advice
4. Use quick actions for common tasks

## Required Environment Variables

### For Fly.io (claude-fly-deployment)
```
GITHUB_TOKEN=ghp_xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### For Vercel
```
GITHUB_TOKEN=ghp_xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
CLAUDE_API_KEY=sk-ant-xxxxx
```

## Deployment Status

### Production URLs
- Frontend: https://unclefrank-bootstrap.vercel.app
- Claude Server: https://uncle-frank-claude.fly.dev
- GitHub Repo: https://github.com/bhuman-ai/unclefrank-bootstrap

### Last Successful Deployments
- Vercel: Auto-deploys from GitHub master
- Fly.io: Manual deploy via `fly deploy` from claude-fly-deployment/

## File Structure (What's Actually Used)

```
/unclefrank-bootstrap/
  /api/                    # Vercel serverless functions
    github.js             ✅ Working
    approve-task.js       ✅ Working  
    frank.js              ✅ Working
  /claude-fly-deployment/  # Fly.io server
    server-queue.js       ✅ Working
    tmux-injector.sh      ✅ Working
    Dockerfile            ✅ Working
  /public/                 # Frontend
    index.html            ✅ Working
    frank-chat.html       ✅ Working
```

## Next Priority Features
1. Fix Claude authentication persistence
2. Add automatic error recovery
3. Build Task Instance Dashboard UI
4. Wire up System Agents for validation
5. Implement checkpoint retry logic

---

*This document reflects ONLY what is currently deployed and working in production.*
*For future vision and planned features, see `/docs to work towards/`*