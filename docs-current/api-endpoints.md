# Current API Endpoints

## Tasks API

### GET /api/tasks
Returns all tasks in the system.

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-123",
      "title": "Task title",
      "description": "Task description",
      "status": "pending|in_progress|completed",
      "created": "2024-08-10T..."
    }
  ]
}
```

### POST /api/tasks
Creates a new task.

**Request:**
```json
{
  "title": "Task title",
  "description": "Task description"
}
```

### GET /api/tasks/[id]
Get specific task by ID.

### PUT /api/tasks/[id]
Update task status or details.

### DELETE /api/tasks/[id]
Delete a task.

## Checkpoint API

### POST /api/checkpoint
Create checkpoint from task.

**Request:**
```json
{
  "taskId": "task-123",
  "checkpoint": {
    "name": "CP-001",
    "passCriteria": "Test passes"
  }
}
```

### POST /api/checkpoint/execute
Execute checkpoint with pass/fail result.

**Request:**
```json
{
  "checkpointId": "cp-123",
  "result": "pass|fail",
  "output": "Execution output"
}
```

## Claude Sessions API (on Fly.io)

### POST /api/sessions
Create new Claude session.

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "created",
  "workspace": "/workspace/uuid"
}
```

### POST /api/sessions/[id]/execute
Execute command in Claude session.

**Request:**
```json
{
  "message": "Create a login page"
}
```

### GET /api/sessions/[id]/status
Get session execution status.

**Response:**
```json
{
  "status": "processing|completed|error",
  "lastResponse": "Claude's response",
  "filesCreated": []
}
```