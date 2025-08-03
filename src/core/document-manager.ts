import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import type { Task, Checkpoint, ProjectDraft } from '../types';

export class DocumentManager {
  constructor(private workingDir: string) {}

  async readProjectMd(): Promise<string> {
    const path = join(this.workingDir, 'Project.md');
    if (!existsSync(path)) {
      console.log(chalk.yellow('Project.md not found, creating template...'));
      await this.createProjectTemplate();
    }
    return readFile(path, 'utf-8');
  }

  async writeProjectDraft(draft: ProjectDraft): Promise<void> {
    const path = join(this.workingDir, 'drafts', `project-draft-${draft.id}.md`);
    await this.ensureDir(dirname(path));
    await writeFile(path, draft.content, 'utf-8');
    console.log(chalk.green(`✓ Draft saved: ${path}`));
  }

  async createTask(task: Task): Promise<void> {
    const taskDir = join(this.workingDir, 'data', 'tasks', task.id);
    await this.ensureDir(taskDir);
    
    const taskMd = this.generateTaskMd(task);
    await writeFile(join(taskDir, 'task.md'), taskMd, 'utf-8');
    
    const taskJson = JSON.stringify(task, null, 2);
    await writeFile(join(taskDir, 'task.json'), taskJson, 'utf-8');
    
    console.log(chalk.green(`✓ Task created: ${task.name}`));
  }

  async createCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const checkpointDir = join(this.workingDir, 'data', 'checkpoints', checkpoint.id);
    await this.ensureDir(checkpointDir);
    
    const checkpointMd = this.generateCheckpointMd(checkpoint);
    await writeFile(join(checkpointDir, 'checkpoint.md'), checkpointMd, 'utf-8');
    
    const checkpointJson = JSON.stringify(checkpoint, null, 2);
    await writeFile(join(checkpointDir, 'checkpoint.json'), checkpointJson, 'utf-8');
    
    console.log(chalk.green(`✓ Checkpoint created: ${checkpoint.name}`));
  }

  private generateTaskMd(task: Task): string {
    return `# Task.md — ${task.name}

## Task Overview
- **Task Name:** ${task.name}
- **Objective:** ${task.objective}
- **Acceptance Criteria:**
${task.acceptanceCriteria.map(ac => `  - [ ] ${ac.description}`).join('\n')}

## Contextual References
- **Project.md References:**
  - [Feature: TBD]
  - [User Personas: TBD]

## Checkpoints
| Checkpoint Name | Description | Blocking? | Parallelizable? |
|-----------------|-------------|-----------|-----------------|
${task.checkpoints.map(cp => `| ${cp.name} | ${cp.objective} | ${cp.blocking ? 'Yes' : 'No'} | ${cp.parallelizable ? 'Yes' : 'No'} |`).join('\n')}

## Status
- Current Status: ${task.status}
- Created: ${task.createdAt}
- Updated: ${task.updatedAt}

---

> All checkpoints must be validated before this task moves to 'Awaiting Review'.`;
  }

  private generateCheckpointMd(checkpoint: Checkpoint): string {
    return `# Checkpoint.md — ${checkpoint.name}

## Checkpoint Overview
- **Checkpoint Name:** ${checkpoint.name}
- **Objective:** ${checkpoint.objective}
- **Parent Task:** ${checkpoint.taskId}

## Instructions
${checkpoint.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

## Pass/Fail Test Criteria
${checkpoint.passCriteria.map(pc => `- [ ] ${pc.description}`).join('\n')}

## Execution Status
- Current Status: ${checkpoint.status}
- Retry Attempts: ${checkpoint.retryCount}/${checkpoint.maxRetries}

## Logs & Output
${checkpoint.logs.map(log => `- [${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`).join('\n')}

---

> Every Checkpoint MUST pass its binary tests before proceeding.`;
  }

  private async createProjectTemplate(): Promise<void> {
    const template = `# Project.md — Product PRD & Business Logic

## Purpose
This document represents the live Product Requirements Document (PRD) for the project.

## Business Goals & Logic
- Define the overarching goals and business logic that this product serves.

## User Personas & Journeys
- Detailed breakdown of target users.
- Key user flows and their touchpoints.

## Feature List (Production State)
- Master list of current live features.

## API Integrations & DB Structures
- Current external APIs in use.
- Overview of database schemas in production.

## Constraints & Design Philosophies
- UX Consistency Guidelines.
- Design principles.
- Platform-specific constraints.`;

    await writeFile(join(this.workingDir, 'Project.md'), template, 'utf-8');
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}