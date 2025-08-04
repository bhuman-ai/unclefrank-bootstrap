# Document Manager Usage Guide

## Overview
The Document Manager enforces the sacred flow: **Draft → Validation → Task → Checkpoint → Review → Merge**

No fake shit - real version control, real validation, real state tracking.

## API Endpoints

### Base URL
```
POST /api/document-manager
```

### Actions

#### 1. Health Check
```json
{
  "action": "health-check"
}
```

#### 2. Create Draft
```json
{
  "action": "create-draft",
  "content": "# Project.md content here..."
}
```

Response:
```json
{
  "success": true,
  "draft": {
    "draftId": "draft-1754349741996-bdb80615",
    "version": "1.0.0",
    "status": "draft",
    "createdAt": 1754349741996,
    "metadata": {
      "contentHash": "bdb80615",
      "wordCount": 245,
      "lineCount": 42
    }
  }
}
```

#### 3. Validate Draft
```json
{
  "action": "validate-draft",
  "draftId": "draft-1754349741996-bdb80615"
}
```

Response:
```json
{
  "success": true,
  "draft": {
    "draftId": "draft-1754349741996-bdb80615",
    "status": "validated",
    "validationResults": {
      "ux": { "passed": true, "issues": [] },
      "technical": { "passed": true, "issues": [] },
      "logic": { "passed": true, "issues": [] }
    }
  },
  "allPassed": true
}
```

#### 4. Get Draft Status
```json
{
  "action": "get-draft-status",
  "draftId": "draft-1754349741996-bdb80615"
}
```

#### 5. List All Drafts
```json
{
  "action": "list-drafts"
}
```

#### 6. Create Tasks from Validated Draft
```json
{
  "action": "create-tasks",
  "draftId": "draft-1754349741996-bdb80615"
}
```

Response:
```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-1",
      "name": "Implement Feature X",
      "objective": "Build the core functionality",
      "acceptanceCriteria": ["Feature works", "Tests pass"],
      "checkpoints": [
        {
          "id": "cp1",
          "name": "Setup foundation",
          "objective": "Create base structure",
          "instructions": ["Create files", "Setup dependencies"],
          "passCriteria": ["Files exist", "Dependencies installed"],
          "blocking": true
        }
      ]
    }
  ],
  "count": 1
}
```

#### 7. Merge Draft to Production
```json
{
  "action": "merge-draft",
  "draftId": "draft-1754349741996-bdb80615"
}
```

## Sacred Flow States

### Draft States
- `draft` - Initial state after creation
- `validating` - Currently running validation checks
- `validated` - All validations passed
- `validation-failed` - One or more validations failed
- `validation-error` - Error during validation process
- `tasks-created` - Tasks have been generated from draft
- `executing` - Tasks are being executed via Terragon
- `ready-to-merge` - All tasks complete, awaiting human approval
- `merged` - Successfully merged to production Project.md

### Validation Types
- **UX Validation** - Checks for contradictions with Interface.md and UX patterns
- **Technical Validation** - Verifies technical feasibility and architecture consistency  
- **Logic Validation** - Ensures internal consistency within the draft

## Usage Examples

### Basic Flow
```bash
# 1. Create draft
curl -X POST /api/document-manager \
  -H "Content-Type: application/json" \
  -d '{"action": "create-draft", "content": "# My Project\n\n## Features\n- Feature 1\n- Feature 2"}'

# 2. Validate draft
curl -X POST /api/document-manager \
  -H "Content-Type: application/json" \
  -d '{"action": "validate-draft", "draftId": "draft-123-abc"}'

# 3. Create tasks (if validation passed)
curl -X POST /api/document-manager \
  -H "Content-Type: application/json" \
  -d '{"action": "create-tasks", "draftId": "draft-123-abc"}'

# 4. Merge to production (after task execution and human approval)
curl -X POST /api/document-manager \
  -H "Content-Type: application/json" \
  -d '{"action": "merge-draft", "draftId": "draft-123-abc"}'
```

### Check System Health
```bash
curl -X POST /api/document-manager \
  -H "Content-Type: application/json" \
  -d '{"action": "health-check"}'
```

## Integration with Existing Systems

### Task Orchestrator
- Validated drafts automatically create tasks
- Tasks flow into the existing task orchestrator
- Checkpoints execute via Terragon instances
- Real pass/fail testing with contextless validation

### Branch Tracker  
- Works with existing branch tracking system
- Draft execution can target specific branches
- Branch-aware validation and testing

### Terragon Integration
- Uses Claude Opus 4 for validation and task breakdown
- Real validation checks, not simulations
- Connects to existing Terragon execution pipeline

## File Structure

```
/root/repo/
├── api/document-manager.js     # Main API implementation
├── test-drafts/               # Draft storage directory
│   ├── draft-{id}.md         # Draft content files
│   └── draft-{id}.json       # Draft metadata files
├── test-document-manager.js   # API tests
├── test-sacred-flow.js        # End-to-end flow test
└── DOCUMENT-MANAGER-USAGE.md  # This file
```

## Environment Variables

```bash
CLAUDE_API_KEY=your_claude_api_key_here
TERRAGON_AUTH=your_terragon_session_token_here
```

## Error Handling

### Common Errors
- `400` - Bad request (missing parameters)
- `404` - Draft not found
- `429` - Rate limit exceeded (20 requests/minute per IP)
- `500` - Internal server error

### Validation Failures
When validation fails, the response includes specific issues:
```json
{
  "success": true,
  "allPassed": false,
  "draft": {
    "status": "validation-failed",
    "validationResults": {
      "ux": { 
        "passed": false, 
        "issues": ["Contradicts Interface.md section 3.2"] 
      },
      "technical": { "passed": true, "issues": [] },
      "logic": { "passed": true, "issues": [] }
    }
  }
}
```

## Sacred Flow Enforcement

The system enforces these rules:
1. **No bypassing** - Must follow Draft → Validation → Task → Checkpoint → Review → Merge
2. **Real validation** - Uses Claude for actual contradiction checking
3. **State tracking** - Every draft has a clear status and history
4. **Binary tests** - All checkpoints have clear pass/fail criteria
5. **Human approval** - Final merge requires human confirmation

This is Frank's document management system - no bullshit, just results.