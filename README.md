# Uncle Frank's Bootstrap Core

Minimal bootstrap for the autonomous LLM development platform. No BS, just the core flow.

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
export CLAUDE_API_KEY="your-anthropic-api-key"
export TERRAGON_AUTH="JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D"

# Copy sacred documents to your project
cp /path/to/CLAUDE.md .
```

## Usage

```bash
# Run a task through the system
npm run dev task "Add Discord bot integration"

# Initialize a new project
npm run dev init
```

## Core Flow

1. Request → Classification → Validation
2. Task decomposition into checkpoints
3. Human approval gate
4. Checkpoint execution via Claude
5. Pass/fail testing
6. Merge to production state

## What's Included

- **Meta-Agent**: Request classification and task decomposition
- **Document Manager**: Project.md, Task.md, Checkpoint.md handling
- **Claude Proxy**: Integration with Claude execution engine
- **Principle Enforcer**: Sacred document validation
- **Simple CLI**: Human approval gates

## What's NOT Included

- All 72 helper agents (add them using the system itself)
- Fancy UI (build it through the system)
- Complex dependency graphs
- Automated retries and escalations
- Discord bot, voice input, etc.

## First Task

Use the bootstrap to add its first enhancement:

```bash
npm run dev task "Add validation system for cross-document coherence"
```

This will create the task, decompose it into checkpoints, and execute through Claude.

## Philosophy

Every feature gets added through the system itself. No cowboy coding.