# Interface.md — LLM Development Platform UI Specification

## Purpose
Defines the visual layout, user flows, and interface principles of the LLM-driven development platform. This document governs how users interact with Project.md, Task.md, Checkpoints, and validation flows.

## Scope
- **This document is for the Developer Platform UI.**
- Does not pertain to the end-user product UI being built.
- Platform UX consistency is governed here.

## Core Layout Principles
- **3/4 Screen Document Editor**
  - Claude.md, Project.md, Task.md, Checkpoint.md editing happens here.
- **1/4 Screen Persistent Chat Sidebar**
  - Contextual LLM assistant panel.
  - Can be resized dynamically.

## Screen Structures
11. **Terragon Instance Status Dashboard** — Monitor active Terragon instances per Task:
    - Shows current active agent (CheckpointAgent/TaskAgent)
    - Current Checkpoint in Progress
    - Instance Health (Active/Paused/Errored)
    - Live Logs Preview & Retry Counters
    - Inline actions: Pause/Resume, Rollback, Escalate to Human

12. **Global Logs Dashboard** — Centralized viewer for all Task/Checkpoint logs:
    - Searchable, filterable by Task, Agent, Status
    - Recent Errors, Resolutions, Validation Results

13. **Brainstorm Mode Workspace** — Ideation zone for Project.md Drafts:
    - Freeform chat to discuss and co-create new features
    - LLM prompts questions to refine ideas
    - Convert brainstorm outputs to structured Draft proposals

14. **Slash Command Panel** — Quick trigger interface for invoking custom workflows:
    - Common commands like /smart-task, /redteam
    - Auto-suggested slash commands based on context
    - Inline results and logs post-invocation
    - Slash commands can be invoked by both **humans and LLM agents** during workflows to dynamically chain specialized agents as needed

15. **Inline Escalation Notifications** — UX for human intervention triggers:
    - Persistent notification area for escalated tasks
    - Highlights Task/Checkpoint needing attention
    - Quick actions: Assign to human, view logs, approve/reject resolution
1. **Project Dashboard** — Repo selection, high-level metrics, Claude.md quick view.
2. **Project Workspace View** — Project.md Draft editing, validation buttons.
3. **Task Queue** — Task status management, blockers, prioritization controls.
4. **Task Workspace View** — Task.md editing, dependency chain viewer.
5. **Checkpoint Execution View** — Execution progress, retry logs, validation results.
6. **Validation Dashboard** — System-wide validation result viewer.
7. **Merge Review Screen** — Draft vs Production diff viewer.
8. **Execution Control Panel** — Live queue controls, agent statuses.
9. **GitHub Integration Panel** — Repo browser, PR statuses.
10. **Visual DAG Flow** — Dependency graph of Tasks and Checkpoints.

## Contextual Linking
- Inline suggestions for references to Project.md, Interface.md, and Technical.md.
- Hover panels show linked section summaries.

## Interaction Guidelines
- All flows must enforce the immutable Draft → Validation → Task → Checkpoint → Review structure.
- Users can never bypass the flow.
- LLM proactive prompts assist at every stage.

## Alerts & Feedback
- Validation summaries must persist visually during Project.md edits.
- Retry failures, escalations, and dependency conflicts must notify users in real-time.

## Reserved Future UI
- Hotfix Mode Toggle (locked unless emergency).
- User Role Management Panel (future scoped).

## UX Philosophy
- Reduce cognitive load for non-technical users.
- System enforces rigid structure, but the UI guides with helpful context, suggestions, and proactive validations.
- Every action must have immediate feedback or validation.

