# Auto-Improve System Flow

## Core Concept
The auto-improve system continuously reads `docs-future/`, finds gaps with reality, creates tasks in the Uncle Frank system, and executes them through Claude.

## Detailed Flow

### 1. Gap Analysis Phase
```
Every 5 minutes:
1. Read all .md files in docs-future/
2. Parse for:
   - API endpoints mentioned
   - UI components described  
   - Features listed
   - Workflows defined
3. Compare with docs-current/ 
4. Compare with actual codebase
5. Generate gap list
```

### 2. Task Creation Phase
```
For each gap found:
1. Create task via POST /api/tasks
   {
     "title": "Implement [missing feature]",
     "description": "[from docs-future]",
     "source": "auto-improve",
     "priority": [calculated]
   }
2. Wait for task ID
3. Decompose into checkpoints via POST /api/tasks/decompose
4. Store task-gap relationship
```

### 3. Execution Phase
```
While tasks exist in queue:
1. GET /api/tasks/queue (next task)
2. For each checkpoint:
   a. Send to Claude with full context
   b. NO TIMEOUT - let Claude work
   c. Capture output and created files
   d. Run pass/fail test
   e. POST /api/checkpoint/execute with result
3. If all checkpoints pass:
   - Commit changes
   - Push to GitHub  
   - Mark task complete
4. If any checkpoint fails:
   - Log failure
   - Move to next task
   - Retry later
```

### 4. Documentation Update Phase
```
After task completion:
1. Analyze what was built
2. Update docs-current/ with new reality
3. Remove from docs-future/ if fully implemented
4. Commit documentation updates
```

## Integration Points

### With Uncle Frank Task System
- Uses official `/api/tasks` endpoints
- Respects task queue and priorities
- Creates proper checkpoints
- Reports pass/fail results

### With Claude on Fly.io
- Uses `claude --print --dangerously-skip-permissions`
- No timeout on execution
- Full codebase context provided
- Real implementation, not stubs

### With GitHub/Vercel
- Commits with meaningful messages
- Pushes to master branch
- Triggers Vercel deployments
- Updates tracked in system

## Configuration

### Auto-Improve Settings
```javascript
{
  "interval": 300000, // 5 minutes
  "maxTasksPerIteration": 5,
  "priorityStrategy": "missing-endpoints-first",
  "claudeTimeout": null, // NO TIMEOUT
  "autoCommit": true,
  "autoPush": true,
  "updateDocs": true
}
```

## Example Gap → Task → Completion

### Gap Found
```markdown
# docs-future/auth.md
System should have /api/auth/login endpoint that accepts username/password
```

### Task Created
```json
{
  "id": "task-123",
  "title": "Implement /api/auth/login endpoint",
  "description": "Create login endpoint that accepts username/password per docs-future/auth.md",
  "source": "auto-improve",
  "checkpoints": [
    {
      "name": "CP-001",
      "description": "Create /api/auth/login.js file",
      "passCriteria": "File exists at pages/api/auth/login.js"
    },
    {
      "name": "CP-002", 
      "description": "Implement POST handler",
      "passCriteria": "Handler validates username/password"
    },
    {
      "name": "CP-003",
      "description": "Add error handling",
      "passCriteria": "Returns 401 on invalid credentials"
    }
  ]
}
```

### Claude Execution
```bash
claude --print --dangerously-skip-permissions \
  "Create /api/auth/login endpoint with username/password validation. 
   Requirements: [full context from task]
   Current codebase: [file tree and relevant files]"
```

### Result
- File created: `pages/api/auth/login.js`
- Tests pass
- Committed: "feat: Add login API endpoint (Task-123)"
- Pushed to GitHub
- Deployed to Vercel
- `docs-current/` updated with new endpoint

## Monitoring

### Metrics Tracked
- Gaps found per iteration
- Tasks created per hour
- Checkpoints pass rate
- Average execution time
- Deployment success rate
- Documentation sync status

### Logs Generated
- Gap analysis results
- Task creation confirmations
- Claude execution output
- Git operations
- Deployment status
- Error traces

## Failure Handling

### Claude Timeout
- None! Claude can take as long as needed

### Checkpoint Failure
- Log detailed error
- Continue to next checkpoint if independent
- Retry task after other tasks complete

### Git Conflicts
- Stash changes
- Pull latest
- Reapply and resolve
- Retry push

### Vercel Deploy Failure  
- Log build error
- Create fix task
- Alert in UI
- Continue with next task