# Project.md - Uncle Frank's Doc-Driven Development Platform

## 🎯 Vision
A no-nonsense development platform that enforces structured, doc-driven development through an immutable workflow. Every change follows the same path: Draft → Validation → Task → Checkpoint → Review → Merge.

## 📊 Current Production State

### What's Working
- **Project Workspace UI** - Create and manage drafts with Frank
- **Task Executor** - Direct task execution with Claude
- **Frank Assistant** - Workflow orchestrator with attitude
- **Draft Management** - Create, validate, and track drafts
- **GitHub Integration** - Issues and branch tracking (with token)

### What's Partially Working
- **Validation** - Logic works but can't read actual spec files on Vercel
- **Task Generation** - Smart fallbacks when Claude unavailable
- **Claude Integration** - Works when Fly.io instance is running

### What's Not Working
- **File Persistence** - Uses /tmp (ephemeral)
- **State Management** - Refresh loses everything
- **Checkpoints** - Display only, don't execute
- **Cloud Storage** - Not implemented

## 🏗️ Architecture

### Frontend
- `/public/index.html` - Landing page
- `/public/project-workspace.html` - Draft management UI
- `/public/task-executor.html` - Task execution UI

### Backend APIs
- `/api/project-draft-manager.js` - Draft CRUD and validation
- `/api/frank-assistant.js` - Natural language workflow orchestration
- `/api/claude-executor-integration.js` - Claude task execution

### Infrastructure
- **Frontend**: Vercel (auto-deploy from GitHub)
- **Claude**: Fly.io (uncle-frank-claude.fly.dev)
- **Storage**: Currently /tmp (needs cloud storage)
- **GitHub**: bhuman-ai/unclefrank-bootstrap

## 🔄 The Immutable Flow

```
1. Draft Creation
   └─> GitHub Issue Created
   
2. Validation
   ├─> UX Consistency (Interface.md)
   ├─> Technical Coherence (Technical.md)
   ├─> Logical Consistency
   └─> Dependency Analysis
   
3. Task Breakdown
   ├─> Claude Analysis (if available)
   └─> Smart Fallback Generation
   
4. Checkpoint Decomposition
   └─> (Currently not implemented)
   
5. Execution
   ├─> Claude on Fly.io
   └─> GitHub Branch Management
   
6. Review & Merge
   └─> Update Production Project.md
```

## 🚨 Critical Requirements

### Must Have (Not Working Yet)
1. **GitHub Token** - Nothing works without it
2. **Cloud Storage** - Current file system doesn't persist
3. **State Persistence** - Database or cloud storage needed

### Configuration Needed
```bash
# Vercel Environment Variables Required:
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO=bhuman-ai/unclefrank-bootstrap
CLAUDE_EXECUTOR_URL=https://uncle-frank-claude.fly.dev
```

## 📝 How to Use

### Create a Draft
1. Open Project Workspace
2. Tell Frank what changes you want
3. Frank creates draft with GitHub issue

### Validate Changes
1. Draft checked against specifications
2. Fix any validation errors
3. Re-validate until passing

### Execute Tasks
1. Validated draft breaks into tasks
2. Each task gets GitHub issue
3. Claude executes on separate branch
4. Monitor progress in UI

### Merge to Production
1. All tasks complete
2. Human review and approval
3. Merge updates this Project.md

## 🐛 Known Issues

### High Priority
- No persistence between sessions
- Can't read actual spec files on Vercel
- Checkpoints don't execute

### Medium Priority
- No error recovery
- State lost on refresh
- No authentication

### Low Priority
- No rate limiting
- Missing input validation
- No audit logging

## 🎯 Next Steps

### Immediate (Make it Work)
1. Implement cloud storage (Vercel Blob/S3)
2. Add database for state persistence
3. Fix checkpoint execution

### Soon (Make it Better)
1. Add proper error recovery
2. Implement authentication
3. Add real-time updates

### Later (Make it Scale)
1. Add caching layer
2. Implement queue system
3. Add monitoring/alerting

## 🤖 System Agents

### Core Orchestrators
- **Frank** - Workflow orchestrator
- **Project Draft Manager** - Draft lifecycle
- **Claude Executor** - Task execution

### Validation Agents
- **UX Validator** - Interface.md consistency
- **Technical Validator** - Technical.md coherence
- **Logic Validator** - Contradiction detection

### Execution Agents
- **Task Generator** - Break drafts into tasks
- **Checkpoint Decomposer** - (Not implemented)
- **GitHub Manager** - Issue/PR creation

## 📚 Documentation

- `/CLAUDE.md` - Development constitution
- `/DEPLOYMENT.md` - Setup and configuration
- `/docs/current-state/` - What actually works
- `/docs to work towards/` - Future vision

## 🔗 Links

- **Repository**: [github.com/bhuman-ai/unclefrank-bootstrap](https://github.com/bhuman-ai/unclefrank-bootstrap)
- **Deployment**: Vercel (auto-deploy from master)
- **Claude Executor**: [uncle-frank-claude.fly.dev](https://uncle-frank-claude.fly.dev)

---

*This document represents the current production state. To modify it, create a draft through Frank and follow the immutable flow.*

*Last Updated: January 2025*
*Status: Proof of Concept - Needs Production Hardening*