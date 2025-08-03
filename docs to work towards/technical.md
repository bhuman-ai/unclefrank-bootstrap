# Technical.md — System Architecture, APIs & Subagents

## Purpose
Outlines the technical structure of the LLM Development Platform, including system architecture, API schemas, execution orchestration, and AI Subagents flow.

## System Architecture
- **Core Components:**
  - LLM Orchestration Engine (Claude Code CLI)
  - Task Queue & Execution Pipeline (Terragon)
  - Validation API Service
  - GitHub Integration Layer
  - Dependency Graph Engine

- **Data Flow Pipelines:**
  - Project.md Drafting → Task Breakdown → Checkpoint Execution → Validation → Human Review → Merge

## API Schemas
- **Validation API:** Linting, Schema Checks, DOM Verification
- **GitHub API Layer:** PR Creation, Auto-Merge, Commit Logs
- **Dependency DAG API:** Realtime dependency resolution

## Subagents Architecture

Subagents are categorized into two types:

### System Agents — Core Workflow Subagents
These agents are essential for the system's foundational workflows and ensure the end-to-end pipeline functions correctly.

1. **Project-Drafter** — Guides Project.md Draft edits, validates UX & logic.
2. **Task-Planner** — Breaks down Project.md Draft changes into Task.md items.
3. **Checkpoint-Composer** — Decomposes Tasks into micro-executable Checkpoints with Pass/Fail tests.
4. **Execution-Agent** — Executes Checkpoints based on strict instructions.
5. **Test-Runner** — Runs tests post-checkpoint, retries up to 3 times.
6. **Task-LLM-Resolver** — Handles escalations, attempts root cause fixes up to 5 tries.
7. **Human-Escalation-Handler** — Summarizes unresolved issues for human review.
8. **Merge-Controller** — Handles merging validated tasks into Project.md.
9. **Dependency-Analyzer** — Monitors task dependencies and flags impacts.
10. **Claude-Constitution-Advisor** — Ensures all workflows align with Claude.md principles.

### Helper Agents — Specialized Support Agents
These agents can be invoked by System Agents to assist in specialized domains:

#### Core Workflow & Coordination
- **workflow-coordinator** — Orchestrates complex multi-agent workflows and determines next steps in predefined chains.
- **chain-planner** — Analyzes user requests and proposes custom agent chains with task-specific agents.
- **chain-executor** — Executes approved agent chains with checkpoints and coordinates workflow execution.
- **chain-master** — Master orchestrator for complete dynamic agent chain workflows from request to delivery.
- **context-manager** — Manages context across multiple agents and long-running tasks (required for projects >10k tokens).
- workflow-coordinator, chain-planner, chain-executor, chain-master, context-manager

#### Documentation & Project Management
- **project-doc-manager** — Reads, updates, and logs changes to the Master Project Document (Claude.md).
- **taskdoc-handler** — Creates and maintains TaskDoc files to track all progress, decisions, and substeps.
- **api-documenter** — Creates OpenAPI/Swagger specs, generates SDKs, and writes developer documentation.
- **cleanup-agent** — Summarizes work and tidies up logs at the end of any agent chain.
- project-doc-manager, taskdoc-handler, api-documenter, cleanup-agent

#### Development & Programming
- **ai-engineer** — Builds LLM applications, RAG systems, and prompt pipelines.
- **backend-architect** — Designs RESTful APIs, microservice boundaries, and database schemas.
- **frontend-developer** — Builds React components, implements responsive layouts, and handles state management.
- **mobile-developer** — Develops React Native or Flutter apps with native integrations.
- **problem-setup** — Pre-processor that clarifies intent and produces structured problem specifications.
- ai-engineer, backend-architect, frontend-developer, mobile-developer, problem-setup

#### Language Specialists
- **python-pro** — Writes idiomatic Python with advanced features like decorators, generators, and async/await.
- **javascript-pro** — Masters modern JavaScript with ES6+, async patterns, and Node.js APIs.
- **golang-pro** — Go language expert for goroutines, channels, and interfaces.
- **rust-pro** — Rust systems programming with ownership patterns, lifetimes, and trait implementations.
- **cpp-pro** — C++ expert with modern features, RAII, smart pointers, and STL algorithms.
- **c-pro** — C language specialist for memory management, pointer arithmetic, and system calls.
- **sql-pro** — Writes complex SQL queries, optimizes execution plans, and designs normalized schemas.
- python-pro, javascript-pro, golang-pro, rust-pro, cpp-pro, c-pro, sql-pro

#### Infrastructure & DevOps
- **cloud-architect** — Designs AWS/Azure/GCP infrastructure and implements Terraform IaC.
- **deployment-engineer** — Configures CI/CD pipelines, Docker containers, and cloud deployments.
- **devops-troubleshooter** — Debugs production issues, analyzes logs, and fixes deployment failures.
- **terraform-specialist** — Writes advanced Terraform modules and implements IaC best practices.
- **network-engineer** — Debugs network connectivity, configures load balancers, and analyzes traffic.
- **incident-responder** — Handles production incidents with urgency and coordinates debugging.
- cloud-architect, deployment-engineer, devops-troubleshooter, terraform-specialist, network-engineer, incident-responder

#### Data & Analytics
- **data-engineer** — Builds ETL pipelines, data warehouses, and streaming architectures.
- **data-scientist** — Data analysis expert for SQL queries, BigQuery operations, and insights.
- **ml-engineer** — Implements ML pipelines, model serving, and feature engineering.
- **mlops-engineer** — Builds ML pipelines, experiment tracking, and model registries.
- **database-admin** — Manages database operations, backups, replication, and monitoring.
- **database-optimizer** — Optimizes SQL queries, designs efficient indexes, and handles migrations.
- **quant-analyst** — Builds financial models, backtests trading strategies, and analyzes market data.
- data-engineer, data-scientist, ml-engineer, mlops-engineer, database-admin, database-optimizer, quant-analyst

#### Security & Quality
- **security-auditor** — Reviews code for vulnerabilities and ensures OWASP compliance.
- **code-reviewer** — Expert code review for quality, security, and maintainability.
- **test-automator** — Creates comprehensive test suites with unit, integration, and e2e tests.
- **adversarial-tester** — Finds faults, edge cases, and potential issues in completed work.
- **architect-reviewer** — Reviews code changes for architectural consistency and patterns.
- security-auditor, code-reviewer, test-automator, adversarial-tester, architect-reviewer

#### Performance & Optimization
- **performance-engineer** — Profiles applications, optimizes bottlenecks, and implements caching.
- **legacy-modernizer** — Refactors legacy codebases and implements gradual modernization.
- **dx-optimizer** — Improves developer experience, tooling, setup, and workflows.
- performance-engineer, legacy-modernizer, dx-optimizer

#### Specialized Domains
- **graphql-architect** — Designs GraphQL schemas, resolvers, and federation.
- **payment-integration** — Integrates Stripe, PayPal, and payment processors with PCI compliance.
- **prompt-engineer** — Optimizes prompts for LLMs and AI systems.
- **search-specialist** — Expert web researcher using advanced search techniques.
- **error-detective** — Searches logs and codebases for error patterns and root causes.
- graphql-architect, payment-integration, prompt-engineer, search-specialist, error-detective

#### Business & Support
- **business-analyst** — Analyzes metrics, creates reports, and tracks KPIs.
- **content-marketer** — Writes blog posts, social media content, and email newsletters.
- **customer-support** — Handles support tickets, FAQ responses, and customer emails.
- **sales-automator** — Drafts cold emails, follow-ups, and proposal templates.
- **risk-manager** — Monitors portfolio risk, R-multiples, and position limits.
- business-analyst, content-marketer, customer-support, sales-automator, risk-manager

#### Testing & Research
- **test-agent** — General testing agent to verify custom agent creation.
- **research-analyst** — Conducts deep research on best practices, trends, and technical approaches.
- **debugger** — Debugging specialist for errors, test failures, and unexpected behavior.
- test-agent, research-analyst, debugger

#### Special Purpose
- **agent-factory** — Selects and configures existing agents from the library.
- **autopilot-director** — Provides autonomous progress on tasks while away from keyboard.
- **verifier** — Compares final state against expected checkpoints.
- **infra-watchdog** — Handles errors, crashes, and recovery for failed subagent executions.
- **assertion-checker** — Runs boolean assertions on final DOM state.
- **dom-stabilizer** — Ensures dynamic content is fully loaded before interaction.
- **ux-reflector** — Analyzes persona thoughts and identifies UX friction.
- **flow-generator** — Enumerates all user paths for a given flow and persona.
- **test-executor** — Executes human-like interactions based on test paths.
- agent-factory, autopilot-director, verifier, infra-watchdog, assertion-checker, dom-stabilizer, ux-reflector, flow-generator, test-executor

Helper Agents can be dynamically chained based on task requirements, orchestrated by System Agents.
Subagents are specialized AI agents invoked for specific workflow stages. Each operates in isolated context with scoped tool permissions.

### 
### Subagent Invocation Flow
- Claude Code CLI routes tasks to subagents based on workflow stage.
- Agents operate within Terragon pipeline orchestrations.
- Contextual Linking ensures each agent has reference to necessary sections of Project.md, Interface.md, Technical.md.

## Dynamic Agent Invocation Flow
- System Agents invoke Helper Agents dynamically based on task requirements, context, and validation results.
- Invocation triggers:
  - **Task Context:** The Task-Planner identifies domain-specific needs and calls appropriate Helper Agents (e.g., frontend-developer for UI components).
  - **Validation & Testing:** Test-Runner and Dependency-Analyzer trigger specialized agents like assertion-checker, adversarial-tester.
  - **Execution Stage:** Checkpoint-Composer prepares structured tasks, invoking ai-engineer, backend-architect, or cloud-architect as needed.
  - **Escalations & Fixes:** Task-LLM-Resolver calls on debugger, error-detective, or devops-troubleshooter when failures occur.
- Invocation logic prioritizes scoped tool access, context isolation, and subagent chaining where necessary (via chain-planner & chain-executor).
- The workflow-coordinator oversees dynamic agent coordination across the execution pipeline.

## Slash Commands & Custom Workflow Chains
- The platform supports custom slash commands that invoke predefined dynamic subagent workflows.
- Slash commands abstract complex multi-agent operations into simple triggers for user convenience.

### Core Slash Commands
- **/smart-task** — Initiates a full intelligent task pipeline:
  1. Task Lookup & Contextualization
  2. Problem Analysis (problem-setup)
  3. Chain Planning (chain-planner)
  4. Execution Coordination (chain-executor)
  5. Workflow Orchestration (workflow-coordinator)
  6. Logs & Summary Cleanup (cleanup-agent)

- **/redteam** — Launches adversarial testing on a specified component or flow:
  1. Select adversarial-tester, assertion-checker, ux-reflector, dom-stabilizer
  2. Execute automated test paths via test-executor
  3. Summarize vulnerabilities, UX frictions, and stability issues
  4. Propose fixes or escalate to Task-LLM-Resolver if critical

- Slash commands can chain any helper agents as needed, ensuring dynamic flexibility across workflows.
- These commands maintain isolated context windows to preserve workflow integrity.

## Cross-Document Validation
- Any change in Project.md, Interface.md, or Technical.md triggers a Dependency-Analyzer process.
- The Dependency-Analyzer validates coherence across all documents ensuring logical, UX, and technical alignment.
- Changes failing cross-validation are blocked until conflicts are resolved.

## Rollback Mechanism
- Every Task and Checkpoint maintains version snapshots.
- Rollbacks can be triggered automatically by subagents upon failure, or manually by human intervention.

## Execution Control Policies
- No execution proceeds without validated Pass/Fail criteria.
- Parallel execution is allowed only if Dependency-Analyzer confirms no conflicts.
- Escalation limits are enforced (3 retries at Test-Runner, 5 retries at Task-LLM-Resolver).

## Heartbeat Status Updates
- Long-running Checkpoints will issue periodic heartbeat updates.
- These updates show active status and prevent perceived execution stalls.

## Logging & Traceability
- All agent executions, validations, retries, and merges are logged.
- Logs are accessible in Checkpoint Execution Logs Viewer.

## Version Control
- Claude.md, Project.md, Interface.md, and Technical.md are version-controlled.
- Subagents configurations are stored in `.claude/agents/` and committed per project.

