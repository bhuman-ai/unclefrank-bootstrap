# Task: Document Management System for Uncle Frank's Sacred Flow

## Executive Summary
Build a **real, working** document management system that enforces the sacred development flow (Draft → Validation → Task → Checkpoint → Review → Merge) with actual version control, validation, and state tracking. No simulations, no mocks, no bullshit.

## Sacred Principle Alignment
This system enforces ALL sacred principles from Claude.md:
- **Single Source of Truth**: Only ONE active draft at a time, Project.md remains production truth
- **Immutable Flow**: System BLOCKS any attempt to bypass Draft → Validation → Task → Checkpoint → Review → Merge
- **LLM First Ideation**: All drafts created with LLM collaboration, validated by Claude
- **Micro-Execution Philosophy**: Tasks auto-decompose into binary pass/fail checkpoints  
- **No Bypassing**: API literally won't allow progression without validation passing
- **Uncle Frank Personality**: All prompts, errors, and logs in Frank's no-BS Brooklyn style

## Problem Statement
We have all the pieces but no conductor:
- ✅ Sacred flow is defined in CLAUDE.md
- ✅ Checkpoint execution works with Claude 
- ✅ Branch-aware testing exists
- ❌ **MISSING**: The system to track Project.md drafts through the entire pipeline

Without this, we're just pretending to follow the flow. We need real enforcement.

## Detailed Implementation Requirements

### 1. Core API Structure (`/api/document-manager.js`)

#### Required Endpoints

##### POST `/api/drafts/create`
```javascript
// Input
{
  "content": "markdown content of Project.md draft",
  "author": "user|llm",
  "description": "What this draft changes"
}

// Output
{
  "draftId": "draft-1734567890-abc123",
  "version": "1.0.0",
  "branch": "draft-1734567890-abc123",
  "status": "draft",
  "createdAt": "2024-12-09T10:30:00Z"
}
```
**Implementation**: 
- Create git branch for this draft
- Store draft content in `drafts/{draftId}/Project.md`
- Initialize state tracking in database/file

##### POST `/api/drafts/{draftId}/validate`
```javascript
// Triggers REAL validation using Claude/Terragon
// Output
{
  "draftId": "draft-1734567890-abc123",
  "status": "validating|validated|failed",
  "validationResults": {
    "ux": {
      "passed": false,
      "issues": [
        {
          "line": 45,
          "severity": "error",
          "message": "Button placement contradicts mobile-first principle defined in line 12"
        }
      ]
    },
    "technical": {
      "passed": true,
      "issues": []
    },
    "logic": {
      "passed": false,
      "issues": [
        {
          "section": "Authentication",
          "message": "OAuth2 flow conflicts with stateless API requirement"
        }
      ]
    }
  },
  "canProceed": false
}
```
**Implementation**:
- Send draft to Claude for contradiction detection
- Parse response for specific issues
- Block progression if validation fails

##### GET `/api/drafts/{draftId}/status`
```javascript
// Real-time status of draft
{
  "draftId": "draft-1734567890-abc123",
  "version": "1.0.0",
  "status": "executing", // draft|validating|validated|task-generation|task-executing|ready-to-merge|merged|failed
  "currentPhase": {
    "name": "task-execution",
    "progress": "3/7 tasks complete",
    "blockers": []
  },
  "validationResults": {...},
  "tasks": [
    {
      "taskId": "task-001",
      "status": "completed",
      "checkpoints": ["cp-001", "cp-002"]
    }
  ],
  "timeline": [
    {"timestamp": "...", "event": "draft_created"},
    {"timestamp": "...", "event": "validation_started"},
    {"timestamp": "...", "event": "validation_passed"}
  ]
}
```

##### GET `/api/drafts`
```javascript
// List all drafts with filtering
{
  "drafts": [
    {
      "draftId": "...",
      "status": "...",
      "createdAt": "...",
      "summary": "First 100 chars of description"
    }
  ],
  "filters": {
    "status": "validated",
    "dateRange": "last-7-days"
  }
}
```

##### POST `/api/drafts/{draftId}/generate-tasks`
```javascript
// Only works if status === "validated"
// Sends to Claude for task breakdown
{
  "tasks": [
    {
      "taskId": "task-001",
      "title": "Implement user authentication",
      "acceptanceCriteria": [...],
      "estimatedCheckpoints": 5
    }
  ]
}
```

##### POST `/api/drafts/{draftId}/merge`
```javascript
// Requires human approval token
{
  "approvalToken": "human-approval-xyz",
  "mergeStrategy": "squash|merge|rebase"
}

// Output
{
  "merged": true,
  "commitHash": "abc123...",
  "productionVersion": "2.0.0"
}
```

### 2. State Management Structure (Aligned with docs/project.md)

```javascript
// Store in: /data/drafts/{draftId}/state.json
{
  "draftId": "draft-1734567890-abc123",
  "version": "1.0.0",
  "content": "full markdown content",
  "contentHash": "sha256:...",
  "branch": "draft-1734567890-abc123",
  "githubIssueNumber": 123, // REQUIRED: Per project.md - "Every task is immediately persisted as a GitHub issue"
  
  "status": "validated", // Enum: draft|validating|validated|task-generation|task-executing|ready-to-merge|merged|failed
  
  "metadata": {
    "author": "user|llm",
    "description": "Adding payment processing flow",
    "createdAt": "2024-12-09T10:30:00Z",
    "lastModified": "2024-12-09T11:45:00Z",
    "mergedAt": null
  },
  
  "validationResults": {
    "performedAt": "2024-12-09T10:45:00Z",
    "ux": {
      "passed": false,
      "validator": "claude",
      "issues": [...]
    },
    "technical": {
      "passed": true,
      "validator": "claude",
      "issues": []
    },
    "logic": {
      "passed": true,
      "validator": "claude",
      "issues": []
    },
    "overallPassed": false
  },
  
  "tasks": [
    {
      "taskId": "task-001",
      "githubIssueNumber": 456, // Each task gets its own GitHub issue
      "status": "completed",
      "checkpoints": [
        {
          "id": "cp-001",
          "status": "passed",
          "executedBy": "claude-session-xyz",
          "terrragonInstanceId": "terragon-abc123", // Per checkpoint.md - each task spawns unique Terragon instance
          "retryAttempts": 0,
          "binaryTests": [
            {"name": "Button renders in DOM", "passed": true},
            {"name": "API response matches schema", "passed": true}
          ]
        }
      ]
    }
  ],
  
  "approvals": {
    "required": true,
    "humanApproval": null,
    "llmReview": {
      "timestamp": "...",
      "recommendation": "approve_with_conditions",
      "conditions": [...]
    }
  },
  
  "timeline": [
    {
      "timestamp": "2024-12-09T10:30:00Z",
      "event": "draft_created",
      "actor": "user",
      "details": {}
    },
    {
      "timestamp": "2024-12-09T10:45:00Z",
      "event": "validation_started",
      "actor": "system",
      "details": {"triggeredBy": "api_call"}
    }
  ]
}
```

### 3. Validation Implementation Details (Frank Style)

#### UX Validation (via Claude)
```javascript
async function validateUX(draftContent) {
  const prompt = `
    Listen up, I need you to tear this Project.md draft apart like Frank would.
    Find REAL contradictions, not theoretical bullshit:
    
    1. Check if UI elements mentioned in different sections actually conflict
       - Example: "mobile-first" in line 10 but "desktop-only features" in line 50
    2. Find user flows that make no goddamn sense
       - Example: "one-click checkout" but requires 5 authentication steps
    3. Spot accessibility claims that contradict the actual implementation
    4. Call out any UX promises we can't actually deliver
    
    Don't give me "might be an issue" - give me "this WILL break because..."
    Return specific line numbers and actual problems in JSON format.
    
    Draft content:
    ${draftContent}
  `;
  
  // Send to Claude executor
  const response = await claudeExecutor.execute(prompt);
  return parseUXValidation(response);
}
```

#### Technical Validation (Cross-reference with Technical.md)
```javascript
async function validateTechnical(draftContent, technicalMd) {
  const prompt = `
    Frank here. Check if this draft is technically full of shit or actually doable.
    
    Compare against our Technical.md to find:
    1. API promises that our backend can't deliver
       - Example: "real-time sync" but we're using REST not WebSockets
    2. Database requirements that conflict with our schema
       - Example: "store user preferences" but no preferences table exists
    3. Architecture conflicts that will blow up in production
       - Example: "stateless API" but draft requires session storage
    4. Performance promises we can't keep with current stack
    
    Be specific. Say "Line X conflicts with Technical.md section Y because Z"
    
    Draft content:
    ${draftContent}
    
    Current Technical.md:
    ${technicalMd}
  `;
  
  const response = await claudeExecutor.execute(prompt);
  return parseTechnicalValidation(response);
}
```

#### Logic Validation
```javascript
async function validateLogic(draftContent) {
  const prompt = `
    Analyze this Project.md draft for logical contradictions:
    1. Check if business rules conflict
    2. Verify state machines are consistent
    3. Ensure no circular dependencies
    4. Check for mutually exclusive requirements
    
    Return contradictions with specific references.
    
    Draft content:
    ${draftContent}
  `;
  
  const response = await claudeExecutor.execute(prompt);
  return parseLogicValidation(response);
}
```

### 4. Integration Requirements (Per Sacred Documents)

#### With Existing Systems
1. **Claude Executor** (`/claude-fly-deployment/`)
   - Use for all validation and task generation
   - Real execution via our working queue system
   - Each validation creates a Claude session

2. **GitHub Integration** (MANDATORY per project.md)
   - Create GitHub issue IMMEDIATELY when draft created
   - Add 'draft', 'claude', 'task' labels
   - Update issue with validation results
   - Link all task issues to parent draft issue
   - Create PR only after validation passes

3. **Terragon Instance Management** (per checkpoint.md)
   - Spawn unique Terragon instance per task
   - Monitor instance health (active|paused|errored)
   - Track which agent is replying (CheckpointAgent|TaskAgent)
   - Show heartbeat status for long-running checkpoints

4. **Cross-Document Validation** (per project.md)
   - Run Dependency-Analyzer against Interface.md and Technical.md
   - Ensure contextual linking to all master documents
   - Block progression if cross-document coherence fails

#### Required Environment Variables
```bash
GITHUB_TOKEN=ghp_xxxxx
CLAUDE_EXECUTOR_URL=https://uncle-frank-claude.fly.dev
DRAFT_STORAGE_PATH=/data/drafts
REQUIRE_HUMAN_APPROVAL=true
```

### 5. Error Handling & Recovery

```javascript
// Retry logic for Claude validation
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function validateWithRetry(validationFn, content) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await validationFn(content);
    } catch (error) {
      console.error(`Validation attempt ${i + 1} failed:`, error);
      if (i < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * Math.pow(2, i)); // Exponential backoff
      } else {
        throw new Error(`Validation failed after ${MAX_RETRIES} attempts`);
      }
    }
  }
}
```

### 6. Test Scenarios

#### Scenario 1: Happy Path
```javascript
// Test: Create → Validate → Generate Tasks → Execute → Merge
test('Complete flow from draft to merge', async () => {
  // 1. Create draft
  const draft = await createDraft(validProjectMd);
  expect(draft.status).toBe('draft');
  
  // 2. Validate
  const validation = await validateDraft(draft.draftId);
  expect(validation.overallPassed).toBe(true);
  
  // 3. Generate tasks
  const tasks = await generateTasks(draft.draftId);
  expect(tasks.length).toBeGreaterThan(0);
  
  // 4. Execute tasks (simulate)
  await executeTasks(draft.draftId);
  const status = await getDraftStatus(draft.draftId);
  expect(status.status).toBe('ready-to-merge');
  
  // 5. Merge with approval
  const merge = await mergeDraft(draft.draftId, humanApprovalToken);
  expect(merge.merged).toBe(true);
});
```

#### Scenario 2: Validation Failure
```javascript
test('Draft with contradictions fails validation', async () => {
  const contradictoryDraft = `
    # Project.md
    ## UI: Mobile-first design
    ## API: Desktop-only features
  `;
  
  const draft = await createDraft(contradictoryDraft);
  const validation = await validateDraft(draft.draftId);
  
  expect(validation.ux.passed).toBe(false);
  expect(validation.ux.issues).toContainEqual(
    expect.objectContaining({
      message: expect.stringContaining('mobile-first')
    })
  );
  
  // Should not be able to generate tasks
  await expect(generateTasks(draft.draftId)).rejects.toThrow('Draft not validated');
});
```

#### Scenario 3: Merge Without Approval
```javascript
test('Cannot merge without human approval', async () => {
  const draft = await createValidatedDraft();
  
  await expect(mergeDraft(draft.draftId, null)).rejects.toThrow('Human approval required');
  await expect(mergeDraft(draft.draftId, 'invalid-token')).rejects.toThrow('Invalid approval token');
});
```

## Enforcement Mechanisms (No Bypassing)

```javascript
// API-level enforcement of sacred flow
app.post('/api/drafts/:draftId/generate-tasks', async (req, res) => {
  const draft = await getDraft(req.params.draftId);
  
  // HARD BLOCK if not validated
  if (draft.status !== 'validated') {
    return res.status(403).json({
      error: "Frank says: You trying to pull a fast one? Validate your shit first.",
      currentStatus: draft.status,
      required: 'validated'
    });
  }
  
  // HARD BLOCK if another draft is active
  const activeDrafts = await getActiveDrafts();
  if (activeDrafts.length > 1) {
    return res.status(409).json({
      error: "Frank says: One draft at a time, genius. Finish what you started.",
      activeDraft: activeDrafts[0].draftId
    });
  }
  
  // Proceed only if all checks pass
  // ...
});
```

## Success Criteria

### Must Have (Pass/Fail)
- ✅ Creates git branches for each draft
- ✅ Validates using real Claude executor (not mocked)
- ✅ Blocks invalid drafts from proceeding (API returns 403)
- ✅ Enforces single active draft rule (API returns 409)
- ✅ Tracks complete state through pipeline
- ✅ Requires human approval token for merge
- ✅ Creates GitHub issues for EVERY draft and task
- ✅ Maintains audit trail of all events

### Should Have
- ✅ Retry logic for transient failures
- ✅ Rollback capability if merge fails
- ✅ Parallel validation of UX/Technical/Logic
- ✅ PR integration with validation comments

### Nice to Have
- WebSocket updates for real-time status
- Diff view between draft and production
- Validation rule customization

## File Structure
```
/api/
  document-manager.js       # Main API endpoints
  validators/
    ux-validator.js        # UX contradiction checks
    technical-validator.js # Technical feasibility
    logic-validator.js     # Logic consistency
  
/data/drafts/
  {draftId}/
    Project.md            # Draft content
    state.json           # State tracking
    validation.json      # Validation results
    tasks.json          # Generated tasks

/tests/
  document-manager.test.js
  validators.test.js
  integration.test.js
```

## Implementation Order
1. **Phase 1**: Create draft and state management (2 hours)
2. **Phase 2**: Implement validation with Claude (3 hours)
3. **Phase 3**: Task generation from validated drafts (2 hours)
4. **Phase 4**: Integration with existing systems (2 hours)
5. **Phase 5**: Testing and refinement (1 hour)

## Why This Matters
Without this system, the "sacred flow" is just words in a document. This makes it real:
- **Real validation** catches problems before they become code
- **Real state tracking** shows exactly where each draft is
- **Real enforcement** prevents shortcuts and bypassing
- **Real accountability** through audit trails and approvals

This is the backbone that makes Uncle Frank's methodology actually work, not just sound good.