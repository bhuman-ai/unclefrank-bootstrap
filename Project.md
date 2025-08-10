# Project.md — Uncle Frank's Doc-Driven Development Platform

## Executive Summary
A revolutionary LLM-powered development platform that enforces structured, doc-driven workflows with Uncle Frank's no-BS approach. All development follows the immutable flow: Draft → Validation → Task → Checkpoint → Review → Merge, with GitHub as the single source of truth and Fly.io as the execution infrastructure.

## Business Goals & Logic

### Core Value Proposition
- **Eliminate Development Chaos**: Every change follows a structured, validated workflow
- **Zero Lost Work**: GitHub Issues persist every task immediately upon creation
- **Autonomous Execution**: Tasks execute on Fly.io with Claude Code CLI managing sessions
- **Binary Pass/Fail**: Every checkpoint has clear, measurable success criteria
- **Human Escalation**: Smart escalation when automation hits limits

### Business Objectives
1. Reduce development cycle time by 70% through automated task execution
2. Eliminate context loss between planning and implementation
3. Ensure 100% traceability from requirement to deployment
4. Enable non-technical stakeholders to drive technical changes safely

## System Architecture

### Core Infrastructure
- **Fly.io Execution Server**: uncle-frank-claude.fly.dev
  - Persistent Claude sessions via tmux
  - Queue-based command injection
  - Real-time terminal streaming
  - Automatic session recovery

- **Vercel API Layer**: unclefrank-bootstrap.vercel.app
  - Project Draft Management
  - Task Decomposition
  - Checkpoint Validation
  - System & Helper Agents
  - GitHub Integration

- **GitHub as Source of Truth**
  - All tasks persisted as issues
  - PRs for code changes
  - Labels for status tracking
  - Automated issue lifecycle

## User Personas & Journeys

### Primary Personas

#### 1. Product Owner (Non-Technical)
- **Need**: Drive feature development without coding
- **Journey**: 
  1. Creates Project.md draft describing business requirements
  2. System validates and breaks down into tasks
  3. Reviews human-readable testing instructions
  4. Approves completed work via UI

#### 2. Technical Lead
- **Need**: Ensure code quality and architectural consistency
- **Journey**:
  1. Reviews system-generated task breakdowns
  2. Monitors execution via Task Dashboard
  3. Handles escalations requiring human expertise
  4. Approves PRs before production merge

#### 3. Developer
- **Need**: Focus on complex problems while automation handles routine work
- **Journey**:
  1. Receives escalated issues with full context
  2. Fixes problems system couldn't resolve
  3. Updates checkpoints based on learnings
  4. Resumes automated execution

## Feature List (Production State)

### ✅ Completed Features

#### 1. Claude Execution Infrastructure
- Fly.io deployment with persistent sessions
- TMux-based session management
- Queue-based command injection
- Real-time terminal streaming
- Automatic restart and recovery

#### 2. Doc-Driven Workflow Engine
- Project.md Draft Manager with validation
- Task breakdown from Project changes
- Checkpoint decomposition with Pass/Fail criteria
- GitHub Issues as persistent task storage
- Automated PR creation with Vercel previews

#### 3. Agent System
- 10 System Agents for core workflow
- 40+ Helper Agents for specialized tasks
- Dynamic agent chaining
- Context preservation across agents
- Escalation policies (3 retries → 5 resolver attempts → human)

#### 4. Task Execution Pipeline
- Task Instance Manager (formerly Terragon)
- Real-time monitoring dashboard
- Heartbeat tracking for long operations
- Pause/Resume/Rollback capabilities
- Automatic GitHub issue updates

#### 5. Human Review Workflow
- Testing instructions generation
- Vercel preview URLs in task window
- One-click approval to merge PR
- Automatic deployment on approval

### 🚧 In Development

#### 1. UI Components
- Task Instance Dashboard (monitoring all active instances)
- Global Logs Viewer
- Brainstorm Mode for ideation
- Slash Command interface

#### 2. Advanced Features
- Cross-document validation
- Dependency graph visualization
- Parallel checkpoint execution
- Rollback mechanism

## API Integrations

### External Services
1. **GitHub API**
   - Issue creation and management
   - PR creation and merging
   - Branch management
   - Status checks

2. **Claude API (Anthropic)**
   - Task decomposition
   - Agent intelligence
   - Code generation
   - Error resolution

3. **Fly.io API**
   - Server health monitoring
   - Log streaming
   - Deployment management

4. **Vercel API**
   - Preview deployments
   - Production deployments
   - Environment management

### Internal APIs

#### `/api/project-draft-manager`
- `POST ?action=create` - Create new draft
- `POST ?action=validate` - Validate against Interface.md/Technical.md
- `POST ?action=breakdown` - Generate tasks from draft
- `POST ?action=merge` - Merge to production

#### `/api/checkpoint-decomposer`
- `POST ?action=decompose` - Break task into checkpoints
- `POST ?action=execute` - Execute checkpoint
- `POST ?action=validate` - Check pass/fail criteria

#### `/api/task-instance-manager`
- `POST ?action=spawn` - Create new task instance
- `GET ?action=dashboard` - Get all instances status
- `POST ?action=escalate` - Escalate to human

#### `/api/system-agents`
- `POST ?action=invoke` - Invoke specific system agent
- `POST ?action=validate-draft` - Project Drafter validation
- `POST ?action=plan-tasks` - Task Planner breakdown
- `POST ?action=resolve-failure` - Task LLM Resolver

#### `/api/helper-agents`
- `POST ?action=invoke` - Invoke helper agent
- `POST ?action=chain` - Execute agent chain
- `POST ?action=suggest` - Get agent suggestions for task

## Database Structures

### Task Persistence (File System)
```
/data/
  /drafts/          # Project.md drafts
    /draft-{id}/
      draft.json    # Metadata and state
      project.md    # Draft content
  
  /tasks/           # Task definitions
    /task-{id}/
      task.json     # Task details and checkpoints
  
  /checkpoints/     # Checkpoint execution
    /cp-{id}/
      checkpoint.json # Pass/fail criteria and logs
  
  /task-instances/  # Active execution instances
    /task-{id}/
      instance.json # Current state and progress
  
  /chains/          # Agent chain executions
    /chain-{id}.json
  
  /workflows/       # Multi-agent workflows
    /workflow-{id}.json
```

### GitHub Issue Schema
```json
{
  "title": "Task: {name}",
  "body": "Structured task details with Claude session ID",
  "labels": ["task", "claude", "{status}"],
  "milestone": "Sprint {n}",
  "assignee": null  // Until human escalation
}
```

## Constraints & Design Philosophies

### Uncle Frank's Principles
1. **No BS**: Direct, actionable, measurable
2. **Binary Decisions**: Pass or fail, no maybe
3. **Escalate Fast**: Don't waste time on unsolvable problems
4. **Document Everything**: Full audit trail in GitHub
5. **Test Before Merge**: Every change validated before production

### Technical Constraints
- Maximum checkpoint execution: 30 minutes
- Maximum retries: 3 at checkpoint, 5 at resolver
- Session timeout: 2 hours
- Maximum concurrent instances: 10
- GitHub API rate limits respected

### Design Philosophy
- **Immutable Flow**: No bypassing the validated workflow
- **GitHub First**: All state persisted to GitHub immediately
- **Human in Loop**: Critical decisions require human approval
- **Progressive Automation**: Start simple, learn, improve
- **Fail Safe**: Errors escalate to humans, never fail silently

## Deployment Configuration

### Production Environment
- **Frontend**: unclefrank-bootstrap.vercel.app
- **API**: Vercel Serverless Functions
- **Executor**: uncle-frank-claude.fly.dev
- **Repository**: github.com/bhuman-ai/unclefrank-bootstrap

### Environment Variables
```
GITHUB_TOKEN        # GitHub API access
ANTHROPIC_API_KEY   # Claude API access
CLAUDE_API_KEY      # Backup Claude key
FLY_API_TOKEN       # Fly.io deployment
VERCEL_TOKEN        # Vercel deployment
```

## Success Metrics
- Task completion rate: >90%
- Automated resolution: >70%
- Average time to merge: <4 hours
- Human escalation rate: <15%
- System uptime: >99.9%

## Future Roadmap
1. **Q1 2025**: Complete UI dashboard, implement slash commands
2. **Q2 2025**: Multi-repo support, custom agent builder
3. **Q3 2025**: AI learning from resolutions, predictive task planning
4. **Q4 2025**: Enterprise features, audit compliance, SOC2

## Support & Documentation
- Technical Docs: `/docs/ai-context/`
- API Reference: `/api/` endpoints
- Frank Chat: Available at `/frank-chat.html`
- GitHub Issues: Report bugs and feature requests

---

*Last Updated: January 2025*
*Version: 2.0 - Fly.io Infrastructure*
*Maintained by: Uncle Frank's Team*