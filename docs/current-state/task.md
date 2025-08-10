# Task.md — Current Task Implementation

## How Tasks Actually Work Now

### Task Creation (Current)
- **Input Method**: Text area in UI (index.html)
- **Format**: Free-form text description
- **No Structure**: No acceptance criteria or validation
- **Storage**: GitHub issue created with description

### Current Task Flow
1. User types task in UI
2. Click "Execute Checkpoints"
3. GitHub issue created with label 'task'
4. Claude session spawned on Fly.io
5. Task text sent directly to Claude
6. Claude executes commands
7. Output streamed to UI
8. Code pushed to branch
9. PR sometimes created
10. Human reviews and approves

### What Tasks Look Like Now

#### Example Task Input
```
"Fix the execute button so it updates the GitHub issue with the session ID and add a refresh button to check status"
```

#### What Gets Created
- **GitHub Issue**: 
  - Title: "Task: Fix the execute button..."
  - Body: Full task text + session ID
  - Labels: ['task', 'claude']

- **Claude Session**:
  - ID: UUID generated
  - Branch: `claude-session-{uuid}`
  - Status: processing → completed

### No Checkpoint Breakdown
Currently, tasks are NOT broken into checkpoints. The system has:
- Hardcoded fallback checkpoints (3 generic ones)
- No intelligent decomposition
- No pass/fail criteria
- No retry logic

### Task Status (What Actually Updates)

#### Current Status Values
- `processing` - Claude is working
- `completed` - Claude finished
- `ready_for_review` - PR created (sometimes)
- `error` - Something failed

#### Where Status Lives
1. GitHub Issue labels (sometimes updated)
2. Session object in memory (Fly.io server)
3. `/persistent/sessions.json` file
4. UI state (after refresh)

### No Dependencies
- Tasks execute independently
- No blocking or ordering
- No parallel execution
- One task at a time

## Current Task Execution

### What Claude Actually Does
When a task is sent to Claude, it:
1. Reads the task description
2. Executes commands directly
3. Makes changes to files
4. Commits and pushes code
5. Sometimes creates a PR

### No Validation
- No pre-execution checks
- No acceptance criteria
- No testing requirements
- Success = Claude says done

### Human Review Process (Current)
1. Look at terminal output
2. Check if PR was created
3. Click Vercel preview (if available)
4. Decide if it looks good
5. Click Approve or fix manually

## Task Persistence

### Where Tasks Are Stored
1. **GitHub Issues**: Primary record
2. **Session Files**: `/app/sessions/{id}/`
3. **Memory**: Active sessions map
4. **No Database**: File-based only

### What Gets Lost
- Task history after server restart
- Checkpoint attempts (not tracked)
- Error details (only last error)
- Execution metrics

## Current Limitations

### What Doesn't Work
1. **No Retries**: Fails once, stays failed
2. **No Escalation**: No path to human help
3. **No Validation**: Can't verify success
4. **No Checkpoints**: All or nothing execution
5. **No Context**: Each task starts fresh

### Manual Workarounds
- Re-run task with modified description
- SSH to fix Claude session
- Manually create PR if needed
- Direct GitHub edits for fixes

## Task API (What's Actually Called)

### Creating a Task
```javascript
// 1. Create GitHub Issue
fetch('/api/github?action=create-issue', {
  method: 'POST',
  body: JSON.stringify({
    title: `Task: ${taskDescription.substring(0, 50)}...`,
    body: taskDescription,
    labels: ['task', 'claude']
  })
})

// 2. Create Claude Session
fetch('https://uncle-frank-claude.fly.dev/api/sessions', {
  method: 'POST',
  body: JSON.stringify({ testOnly: false })
})

// 3. Execute Task
fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${sessionId}/execute`, {
  method: 'POST',
  body: JSON.stringify({ 
    message: taskDescription
  })
})
```

### Checking Status
```javascript
// Poll for completion
fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${sessionId}/status`)
// Returns: { status: 'processing|completed|error', lastResponse: {...} }
```

## Task Success Criteria (Informal)

### How We Know It Worked
- Terminal shows expected output
- No error messages
- PR created successfully
- Vercel preview looks right
- Tests pass (if we run them)

### How We Know It Failed
- Error in terminal output
- Claude says "failed"
- No PR created
- Server timeout
- Obviously wrong result

## Common Task Types

### What Works Well
- "Fix bug in X file"
- "Add button to do Y"
- "Update configuration for Z"
- "Create new API endpoint"

### What Struggles
- "Refactor entire system"
- "Implement complex feature"
- "Debug production issue"
- "Optimize performance"

---

*This document reflects how tasks currently work in production.*
*The planned task system is in `/docs to work towards/task.md`*