# Checkpoint.md — Micro Execution Step

## Checkpoint Overview
- **Checkpoint Name:** (Descriptive title)
- **Objective:** (Clear, actionable micro-goal)
- **Parent Task:** [Linked Task.md]

## Instructions
- Step-by-step execution instructions for the agent.
- Minimize ambiguity, enforce strict scope.

## Pass/Fail Test Criteria
- [ ] Binary Test 1 (e.g., "Button renders in DOM")
- [ ] Binary Test 2 (e.g., "API response matches schema")

## Contextual References
- **Project.md References:**
  - [Feature Section]
  - [Relevant Persona Flow]
- **Interface.md References:**
  - [UI Component Specification]
- **Technical.md References:**
  - [API Endpoint Schema]
  - [Backend Component]

## Brainstorm Mode
- Brainstorm Mode is a freeform ideation space within the Project Workspace.
- LLM and user engage in creative, open-ended discussions for generating new feature ideas or architectural concepts.
- Any insights derived can be converted into Project.md Draft proposals.
- Brainstorm Mode does not directly alter production docs until validated and promoted to a Draft.

## Terragon Instance Status Dashboard
- A dedicated UI screen within the platform to monitor all active Terragon Instances.
- Each instance represents a single Task in execution.
- Displays:
  - Task Name
  - Current Active Agent (CheckpointAgent or TaskAgent)
  - Current Checkpoint in Progress
  - Instance Health: [Active | Paused | Errored]
  - Progress Bar of Checkpoint Completion
  - Live Logs Preview (last 5 entries)
  - Retry Attempt Counter per Checkpoint
- Inline actions:
  - Pause/Resume Instance
  - Trigger Manual Rollback
  - Escalate to Human
- This dashboard gives visibility into autonomous agent replies and task progression in real-time.

## Terragon Instance Monitoring
- CheckpointAgents provide periodic status updates (heartbeat replies) for long-running checkpoints.
- Each Task spawns a unique Terragon instance.
- CheckpointAgents autonomously reply within Terragon while a checkpoint is In Progress.
- Once a Checkpoint is completed and submitted, TaskAgent takes over replies.
- Status Dashboard must show active agent replying (CheckpointAgent or TaskAgent) per instance.
- Terragon instance health (active, paused, errored) must be monitored in real-time.
- Partial progress of Checkpoints within a Task is visible in the Task Workspace, including which checkpoints are passed/failed in real-time.
- Each Task spawns a unique Terragon instance.
- CheckpointAgents autonomously reply within Terragon while a checkpoint is In Progress.
- Once a Checkpoint is completed and submitted, TaskAgent takes over replies.
- Status Dashboard must show active agent replying (CheckpointAgent or TaskAgent) per instance.
- Terragon instance health (active, paused, errored) must be monitored in real-time.

## Execution Status
- Current Status: [Pending | In Progress | Pass | Fail]
- Retry Attempts: [0/3]

## Logs & Output
- All execution logs are stored centrally in the Global Logs Dashboard for cross-task visibility.
- Logs also remain accessible within each specific Task and Checkpoint view.
- Log Entry 1: (Execution output summary)
- Log Entry 2: (Validation result summary)
- Log Entry 1: (Execution output summary)
- Log Entry 2: (Validation result summary)

## Escalation Flow
- Auto-retry up to 3 times by Test-Runner Agent.
- If failed after retries, escalate to Task-LLM-Resolver for root cause fix (up to 5 attempts).
- Rollbacks to previous Checkpoint versions can be triggered by either LLMs (auto-detected failures) or manually by humans.
- If unresolved, inline notifications will alert human operators for intervention.
- Upon Task completion, an auto-generated QA Checklist will be provided for human reviewers before marking the task as complete.
- Auto-retry up to 3 times by Test-Runner Agent.
- If failed after retries, escalate to Task-LLM-Resolver for root cause fix.

---

> Every Checkpoint MUST pass its binary tests before proceeding. Logs are recorded for every attempt and referenced in the Validation Dashboard.

> Checkpoint agents can suggest missing steps to Task-Agent if they identify gaps but cannot add new checkpoints themselves.

