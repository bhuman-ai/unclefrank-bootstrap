# Current System Overview

## What We Have Now

### 1. Core Infrastructure
- **Next.js application** deployed on Vercel
- **GitHub repository** (bhuman-ai/unclefrank-bootstrap) 
- **Fly.io deployment** running Claude executor service
- **GitHub → Vercel** automatic deployment pipeline

### 2. API Endpoints (Currently Implemented)

#### Task Management
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/[id]` - Get specific task
- `PUT /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

#### Checkpoint System  
- `GET /api/checkpoint` - Get checkpoints
- `POST /api/checkpoint` - Create checkpoint
- `POST /api/checkpoint/execute` - Execute checkpoint with pass/fail

#### Claude Integration
- `POST /api/sessions` - Create Claude session
- `POST /api/sessions/[id]/execute` - Execute command in session
- `GET /api/sessions/[id]/status` - Get session status

### 3. Current Features

#### Working
- Basic task CRUD operations
- Checkpoint creation and execution
- Claude session management on Fly.io
- Git integration (can push to GitHub)
- Auto-deployment to Vercel on push

#### Not Working/Missing
- Task validation system
- Automatic task → checkpoint breakdown
- UI for task management
- Monitoring dashboard
- Auto-improve integration with task system

### 4. Current File Structure
```
/
├── pages/
│   ├── api/
│   │   ├── tasks/
│   │   ├── checkpoint/
│   │   └── sessions/
│   └── index.js
├── claude-fly-deployment/
│   ├── server-direct.js (Claude executor)
│   ├── auto-improve-direct.js (Gap finder)
│   └── monitor-server.js
├── lib/
│   └── db.js (In-memory database)
└── CLAUDE.md (Development constitution)
```

### 5. Current Problems
- No unified UI
- Auto-improve doesn't create tasks in our system
- No proper monitoring interface
- Missing validation layer
- Patchwork of different approaches