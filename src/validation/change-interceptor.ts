import { watch, FSWatcher } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { InterfaceRules } from './interface-rules';
import { TechnicalRules } from './technical-rules';
import { LogicValidator } from './logic-validator';
import type { ValidationError } from '../types';

export interface ChangeEvent {
  type: 'modify' | 'create' | 'delete';
  path: string;
  content?: string;
  timestamp: Date;
}

export interface ValidationResult {
  allowed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  blockedReason?: string;
}

export class ChangeInterceptor extends EventEmitter {
  private watcher?: FSWatcher;
  private changeQueue: ChangeEvent[] = [];
  private isValidating = false;
  private lastValidContent: string = '';
  private interfaceRules: InterfaceRules;
  private technicalRules: TechnicalRules;
  private logicValidator: LogicValidator;
  
  constructor(private workingDir: string) {
    super();
    this.interfaceRules = new InterfaceRules(workingDir);
    this.technicalRules = new TechnicalRules(workingDir);
    this.logicValidator = new LogicValidator();
  }

  async initialize(): Promise<void> {
    // Load all validation rules
    await this.interfaceRules.parseRules();
    await this.technicalRules.parseConstraints();
    
    // Store the current valid state of Project.md
    try {
      this.lastValidContent = await readFile(join(this.workingDir, 'Project.md'), 'utf-8');
    } catch (error) {
      console.log(chalk.yellow('Project.md not found, will create on first write'));
    }
    
    console.log(chalk.green('✓ Change interceptor initialized'));
  }

  startWatching(): void {
    const projectMdPath = join(this.workingDir, 'Project.md');
    
    // Watch for any changes to Project.md
    this.watcher = watch(projectMdPath, async (eventType, filename) => {
      if (eventType === 'change') {
        await this.interceptChange(projectMdPath);
      }
    });
    
    console.log(chalk.blue('👁️  Watching Project.md for changes...'));
  }

  private async interceptChange(filePath: string): Promise<void> {
    if (this.isValidating) return; // Prevent re-entry during validation
    
    try {
      this.isValidating = true;
      
      // Read the new content
      const newContent = await readFile(filePath, 'utf-8');
      
      // If content hasn't changed, skip
      if (newContent === this.lastValidContent) {
        return;
      }
      
      console.log(chalk.yellow('⚡ Change detected in Project.md, validating...'));
      
      // Create change event
      const changeEvent: ChangeEvent = {
        type: 'modify',
        path: filePath,
        content: newContent,
        timestamp: new Date()
      };
      
      // Add to queue
      this.changeQueue.push(changeEvent);
      
      // Validate the change
      const validationResult = await this.validateChange(newContent);
      
      if (!validationResult.allowed) {
        // Revert the change
        await this.revertChange(filePath);
        
        // Emit validation failure event
        this.emit('validation-failed', {
          change: changeEvent,
          result: validationResult
        });
        
        console.log(chalk.red('✗ Change blocked! Reverting to last valid state.'));
        console.log(chalk.red('Reasons:'));
        validationResult.errors.forEach(error => {
          console.log(chalk.red(`  - ${error.type}: ${error.message}`));
        });
      } else {
        // Update last valid content
        this.lastValidContent = newContent;
        
        // Emit validation success event
        this.emit('validation-passed', {
          change: changeEvent,
          result: validationResult
        });
        
        console.log(chalk.green('✓ Change validated and allowed'));
        
        if (validationResult.warnings.length > 0) {
          console.log(chalk.yellow('Warnings:'));
          validationResult.warnings.forEach(warning => {
            console.log(chalk.yellow(`  - ${warning.type}: ${warning.message}`));
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('Error during validation:'), error);
    } finally {
      this.isValidating = false;
    }
  }

  private async validateChange(content: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // 1. Check against Interface.md rules
    const interfaceValidation = this.interfaceRules.validateAll(content);
    if (!interfaceValidation.valid) {
      interfaceValidation.violations.forEach(violation => {
        errors.push({
          type: 'ux',
          message: violation
        });
      });
    }
    
    // 2. Check against Technical.md constraints
    const technicalValidation = this.technicalRules.validateAll(content);
    if (!technicalValidation.valid) {
      technicalValidation.violations.forEach(violation => {
        errors.push({
          type: 'technical',
          message: violation
        });
      });
    }
    
    // 3. Check for logical contradictions
    const logicValidation = this.logicValidator.validateLogicalCoherence(content);
    logicValidation.contradictions.forEach(contradiction => {
      const validationError: ValidationError = {
        type: 'logic',
        message: contradiction.description,
        suggestion: contradiction.suggestion
      };
      
      if (contradiction.severity === 'error') {
        errors.push(validationError);
      } else {
        warnings.push(validationError);
      }
    });
    
    // 4. Check for sacred flow violations
    const flowViolations = this.checkSacredFlow(content);
    errors.push(...flowViolations);
    
    // 5. Check for draft governance rules
    const draftViolations = this.checkDraftGovernance(content);
    errors.push(...draftViolations);
    
    // Uncle Frank's decision
    const allowed = errors.length === 0;
    const blockedReason = errors.length > 0 
      ? `Uncle Frank says: "You got ${errors.length} violations. Fix 'em or forget about it!"`
      : undefined;
    
    return {
      allowed,
      errors,
      warnings,
      blockedReason
    };
  }

  private checkSacredFlow(content: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check if trying to bypass the flow
    if (content.toLowerCase().includes('bypass') || content.toLowerCase().includes('skip validation')) {
      errors.push({
        type: 'logic',
        message: 'Attempting to bypass sacred flow - this is forbidden by Claude.md'
      });
    }
    
    // Check if the draft workflow is properly defined
    const draftWorkflowPattern = /Draft\s*→\s*Validation\s*→\s*Task\s*→\s*Checkpoint\s*→\s*Review/;
    if (!draftWorkflowPattern.test(content) && content.includes('Draft Workflow')) {
      errors.push({
        type: 'logic',
        message: 'Draft workflow must follow: Draft → Validation → Task → Checkpoint → Review',
        suggestion: 'Update the Draft Workflow section to match the sacred flow'
      });
    }
    
    return errors;
  }

  private checkDraftGovernance(content: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for multiple active drafts
    const draftMentions = content.match(/active\s+draft/gi) || [];
    if (draftMentions.length > 1 && !content.includes('one active Draft')) {
      errors.push({
        type: 'logic',
        message: 'Multiple active drafts detected - only one active draft allowed',
        suggestion: 'Ensure Draft Governance section specifies "one active Draft"'
      });
    }
    
    // Check for auto-merge without human approval
    if (content.includes('auto-merge') && !content.includes('human-approved')) {
      errors.push({
        type: 'logic',
        message: 'Auto-merge mentioned without human approval requirement',
        suggestion: 'All merges require human approval per Claude.md'
      });
    }
    
    return errors;
  }

  private async revertChange(filePath: string): Promise<void> {
    try {
      await writeFile(filePath, this.lastValidContent, 'utf-8');
      console.log(chalk.yellow('↩️  Reverted to last valid state'));
    } catch (error) {
      console.error(chalk.red('Failed to revert change:'), error);
      throw error;
    }
  }

  async validateFile(filePath: string): Promise<ValidationResult> {
    const content = await readFile(filePath, 'utf-8');
    return this.validateChange(content);
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      console.log(chalk.blue('Stopped watching Project.md'));
    }
  }

  getChangeQueue(): ChangeEvent[] {
    return [...this.changeQueue];
  }

  clearChangeQueue(): void {
    this.changeQueue = [];
  }
}