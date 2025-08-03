#!/usr/bin/env node
import { Command } from 'commander';
import { ProjectValidator } from './project-validator';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { runTests } from './test-validator';

const program = new Command();

program
  .name('project-validator')
  .description('Uncle Frank\'s Project.md Validation System - No BS allowed!')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate current Project.md against all rules')
  .action(async () => {
    const validator = new ProjectValidator(process.cwd());
    
    try {
      console.log(chalk.blue('🔍 Validating Project.md...\n'));
      
      await validator.initialize();
      const result = await validator.validateProjectMd();
      
      if (result.valid) {
        console.log(chalk.green('\n✅ Project.md is valid!'));
        console.log(chalk.green('Uncle Frank approves! 👍'));
      } else {
        console.log(chalk.red('\n❌ Project.md has violations!'));
        console.log(chalk.red('Uncle Frank is not happy! 😤'));
        console.log(chalk.red('\nErrors:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  - [${error.type}] ${error.message}`));
          if (error.suggestion) {
            console.log(chalk.yellow(`    💡 ${error.suggestion}`));
          }
        });
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          result.warnings.forEach(warning => {
            console.log(chalk.yellow(`  - [${warning.type}] ${warning.message}`));
          });
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch Project.md for changes and validate in real-time')
  .action(async () => {
    const validator = new ProjectValidator(process.cwd());
    
    try {
      await validator.initialize();
      validator.startWatching();
      
      console.log(chalk.blue('\n👁️  Watching for changes...'));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nStopping validator...'));
        validator.stopWatching();
        process.exit(0);
      });
      
    } catch (error) {
      console.error(chalk.red('Failed to start watcher:'), error);
      process.exit(1);
    }
  });

program
  .command('validate-draft <file>')
  .description('Validate a specific draft file')
  .action(async (file) => {
    const validator = new ProjectValidator(process.cwd());
    
    try {
      await validator.initialize();
      
      const fs = await import('fs/promises');
      const content = await fs.readFile(file, 'utf-8');
      
      const result = await validator.validateDraft({
        id: file,
        content,
        validated: false,
        validationErrors: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      if (result.valid) {
        console.log(chalk.green(`\n✅ Draft "${file}" is valid!`));
      } else {
        console.log(chalk.red(`\n❌ Draft "${file}" has violations!`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run validation system tests')
  .action(async () => {
    await runTests();
  });

program
  .command('init')
  .description('Initialize validation system with template documents')
  .action(async () => {
    console.log(chalk.blue('📝 Initializing validation system...\n'));
    
    // Check if documents already exist
    const fs = await import('fs');
    const existingDocs = [];
    
    if (fs.existsSync('Interface.md')) existingDocs.push('Interface.md');
    if (fs.existsSync('Technical.md')) existingDocs.push('Technical.md');
    if (fs.existsSync('Project.md')) existingDocs.push('Project.md');
    
    if (existingDocs.length > 0) {
      console.log(chalk.yellow(`⚠️  Found existing documents: ${existingDocs.join(', ')}`));
      console.log(chalk.yellow('Skipping creation to avoid overwriting.'));
      console.log(chalk.gray('Delete these files first if you want to reinitialize.\n'));
    }
    
    console.log(chalk.green('✅ Validation system ready!'));
    console.log(chalk.gray('\nAvailable commands:'));
    console.log(chalk.gray('  validate      - Check current Project.md'));
    console.log(chalk.gray('  watch         - Real-time validation'));
    console.log(chalk.gray('  test          - Run test suite'));
    console.log(chalk.gray('\nUncle Frank says: "Let\'s keep it clean!"'));
  });

program.parse(process.argv);