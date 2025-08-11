# Future System Vision

## Complete Uncle Frank Development Platform

### 1. Unified Dashboard UI
Single interface at `/` showing:
- **Live Auto-Improve Monitor**
  - Current iteration number
  - Gaps found between docs-current and docs-future
  - Active task being worked on
  - Claude's real-time output
  - Git commit history
  - Vercel deployment status
  
- **Task Management Panel**
  - All tasks in queue
  - Task status (pending/in_progress/completed)
  - Checkpoint breakdown for each task
  - Pass/fail results
  
- **System Health**
  - Claude connection status
  - GitHub sync status
  - Vercel deployment health
  - Error logs

### 2. Intelligent Auto-Improve Flow

```
docs-future/ → Gap Analysis → Create Tasks → Execute → Deploy
```

1. **Gap Analysis**
   - Reads all files in `docs-future/`
   - Compares with `docs-current/` 
   - Compares with actual codebase
   - Identifies missing features/endpoints/functionality

2. **Task Creation**
   - Creates tasks via `/api/tasks` endpoint
   - Each gap becomes a task with:
     - Clear title
     - Detailed requirements from docs
     - Priority level
     - Acceptance criteria

3. **Checkpoint Generation**
   - Each task auto-decomposes into checkpoints
   - Binary pass/fail criteria
   - Time estimates
   - Dependencies mapped

4. **Execution**
   - Claude executes checkpoints sequentially
   - No timeout - Claude takes the time it needs
   - Real code creation, not placeholders
   - Automatic testing after implementation

5. **Deployment**
   - Git commit with meaningful message
   - Push to GitHub
   - Automatic Vercel deployment
   - Update `docs-current/` with completed features

### 3. Required API Endpoints

#### Task System
- `POST /api/tasks/validate` - Validate task before creation
- `POST /api/tasks/decompose` - Break task into checkpoints
- `GET /api/tasks/queue` - Get next task to execute
- `POST /api/tasks/[id]/complete` - Mark task complete with artifacts

#### Monitoring
- `GET /api/monitor/status` - Real-time system status
- `GET /api/monitor/logs` - Streaming logs
- `GET /api/monitor/metrics` - Performance metrics
- `WebSocket /api/monitor/stream` - Live updates

#### Auto-Improve
- `POST /api/auto-improve/analyze` - Trigger gap analysis
- `GET /api/auto-improve/gaps` - List found gaps
- `POST /api/auto-improve/execute` - Start execution
- `GET /api/auto-improve/status` - Current status

### 4. UI Components Needed

#### Main Dashboard (`/`)
```jsx
<Dashboard>
  <SystemStatus />
  <AutoImproveMonitor />
  <TaskQueue />
  <ExecutionLog />
  <DeploymentStatus />
</Dashboard>
```

#### Auto-Improve Monitor Component
- Real-time log streaming
- Current task progress bar
- Gap analysis results
- Claude thinking indicator
- Execution timer (no timeout)

#### Task Management Component
- Drag-and-drop priority ordering
- Task details modal
- Checkpoint tree view
- Pass/fail indicators
- Rollback controls

### 5. Database Schema

```sql
-- Tasks table
tasks (
  id UUID PRIMARY KEY,
  title TEXT,
  description TEXT,
  source TEXT, -- 'manual' or 'auto-improve'
  priority INTEGER,
  status TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Checkpoints table
checkpoints (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  name TEXT,
  pass_criteria TEXT,
  status TEXT,
  result TEXT, -- 'pass' or 'fail'
  output TEXT,
  executed_at TIMESTAMP
)

-- Gaps table
gaps (
  id UUID PRIMARY KEY,
  type TEXT, -- 'missing_endpoint', 'missing_feature', etc
  description TEXT,
  source_doc TEXT,
  found_at TIMESTAMP,
  task_id UUID REFERENCES tasks(id)
)

-- Deployments table
deployments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  commit_hash TEXT,
  vercel_url TEXT,
  status TEXT,
  deployed_at TIMESTAMP
)
```

### 6. Environment Variables
```env
GITHUB_TOKEN=xxx
GITHUB_REPO=bhuman-ai/unclefrank-bootstrap
ANTHROPIC_API_KEY=xxx (for Claude API)
VERCEL_TOKEN=xxx
DATABASE_URL=xxx
CLAUDE_SESSION_TOKEN=xxx (from Fly.io)
```

### 7. Success Metrics
- Tasks created per hour
- Checkpoints passed vs failed
- Time from gap → deployed feature
- Automatic documentation updates
- Zero manual intervention required