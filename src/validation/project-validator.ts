import { readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { InterfaceRules } from './interface-rules';
import { TechnicalRules } from './technical-rules';
import { LogicValidator } from './logic-validator';
import { ChangeInterceptor } from './change-interceptor';
import type { ValidationError, ProjectDraft } from '../types';

export class ProjectValidator {
  private interfaceRules: InterfaceRules;
  private technicalRules: TechnicalRules;
  private logicValidator: LogicValidator;
  private changeInterceptor: ChangeInterceptor;
  private initialized = false;

  constructor(private workingDir: string) {
    this.interfaceRules = new InterfaceRules(workingDir);
    this.technicalRules = new TechnicalRules(workingDir);
    this.logicValidator = new LogicValidator();
    this.changeInterceptor = new ChangeInterceptor(workingDir);
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue('🚀 Initializing Project.md Validation System...'));
    
    try {
      // Parse all rule documents
      await this.interfaceRules.parseRules();
      await this.technicalRules.parseConstraints();
      await this.changeInterceptor.initialize();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      console.log(chalk.green('✓ Validation system ready!'));
      console.log(chalk.green(`  - ${this.interfaceRules.getRules().length} UI/UX rules loaded`));
      console.log(chalk.green(`  - ${this.technicalRules.getConstraints().length} technical constraints loaded`));
      console.log(chalk.green('  - Logic contradiction detector active'));
      console.log(chalk.green('  - Change interceptor armed'));
      
    } catch (error) {
      console.error(chalk.red('Failed to initialize validation system:'), error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for validation failures
    this.changeInterceptor.on('validation-failed', (event) => {
      console.log(chalk.red('\n🚨 VALIDATION FAILED 🚨'));
      console.log(chalk.red(`Uncle Frank says: "What are you trying to pull here?"`));
      
      // Log detailed violations
      event.result.errors.forEach((error: ValidationError) => {
        console.log(chalk.red(`\n[${error.type.toUpperCase()}] ${error.message}`));
        if (error.suggestion) {
          console.log(chalk.yellow(`  💡 ${error.suggestion}`));
        }
      });
    });

    // Listen for validation success
    this.changeInterceptor.on('validation-passed', (event) => {
      console.log(chalk.green('\n✅ Validation passed!'));
      if (event.result.warnings.length > 0) {
        console.log(chalk.yellow('⚠️  But watch out for these warnings:'));
        event.result.warnings.forEach((warning: ValidationError) => {
          console.log(chalk.yellow(`  - ${warning.message}`));
        });
      }
    });
  }

  async validateDraft(draft: ProjectDraft): Promise<{
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    if (!this.initialized) {
      throw new Error('Validator not initialized. Call initialize() first.');
    }

    console.log(chalk.blue(`\n🔍 Validating draft: ${draft.id}`));
    
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. Validate against Interface.md
    console.log(chalk.gray('  Checking UI/UX consistency...'));
    const uiValidation = this.interfaceRules.validateAll(draft.content);
    if (!uiValidation.valid) {
      uiValidation.violations.forEach(violation => {
        errors.push({
          type: 'ux',
          message: violation
        });
      });
    }

    // 2. Validate against Technical.md
    console.log(chalk.gray('  Checking technical constraints...'));
    const techValidation = this.technicalRules.validateAll(draft.content);
    if (!techValidation.valid) {
      techValidation.violations.forEach(violation => {
        errors.push({
          type: 'technical',
          message: violation
        });
      });
    }

    // 3. Check for logical contradictions
    console.log(chalk.gray('  Checking logical coherence...'));
    const logicValidation = this.logicValidator.validateLogicalCoherence(draft.content);
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

    // 4. Cross-document validation
    console.log(chalk.gray('  Performing cross-document validation...'));
    const crossDocErrors = await this.validateCrossDocumentReferences(draft.content);
    errors.push(...crossDocErrors);

    const valid = errors.length === 0;

    // Uncle Frank's verdict
    if (!valid) {
      console.log(chalk.red(`\n❌ Draft ${draft.id} FAILED validation`));
      console.log(chalk.red(`Uncle Frank says: "${errors.length} violations? Get your act together!"`));
    } else {
      console.log(chalk.green(`\n✅ Draft ${draft.id} passed validation`));
      if (warnings.length > 0) {
        console.log(chalk.yellow(`Uncle Frank says: "It's good, but keep an eye on those ${warnings.length} warnings"`));
      } else {
        console.log(chalk.green(`Uncle Frank says: "Now that's what I'm talking about!"`));
      }
    }

    return { valid, errors, warnings };
  }

  private async validateCrossDocumentReferences(content: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Extract all document references
    const docReferences = content.matchAll(/(?:references?|links?\s+to|see)\s+(\w+\.md)(?:#(\w+))?/gi);
    
    for (const match of docReferences) {
      const [, docName, section] = match;
      
      // Check if referenced document exists
      try {
        const docPath = join(this.workingDir, docName);
        const docContent = await readFile(docPath, 'utf-8');
        
        // If section is specified, check if it exists
        if (section) {
          const sectionPattern = new RegExp(`##?\\s+${section}`, 'i');
          if (!sectionPattern.test(docContent)) {
            errors.push({
              type: 'logic',
              message: `Referenced section "${section}" not found in ${docName}`,
              suggestion: `Check available sections in ${docName}`
            });
          }
        }
      } catch (error) {
        errors.push({
          type: 'logic',
          message: `Referenced document "${docName}" not found`,
          suggestion: 'Ensure all referenced documents exist'
        });
      }
    }
    
    return errors;
  }

  startWatching(): void {
    if (!this.initialized) {
      throw new Error('Validator not initialized. Call initialize() first.');
    }
    
    this.changeInterceptor.startWatching();
    console.log(chalk.blue('\n👁️  Real-time validation active'));
    console.log(chalk.gray('Any changes to Project.md will be validated immediately'));
  }

  stopWatching(): void {
    this.changeInterceptor.stopWatching();
  }

  async validateProjectMd(): Promise<{
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    try {
      const content = await readFile(join(this.workingDir, 'Project.md'), 'utf-8');
      const draft: ProjectDraft = {
        id: 'current',
        content,
        validated: false,
        validationErrors: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return this.validateDraft(draft);
    } catch (error) {
      console.error(chalk.red('Failed to read Project.md:'), error);
      throw error;
    }
  }
}