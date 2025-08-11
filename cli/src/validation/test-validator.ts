#!/usr/bin/env node
import { ProjectValidator } from './project-validator';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface TestCase {
  name: string;
  content: string;
  shouldPass: boolean;
  expectedErrors?: string[];
}

const testCases: TestCase[] = [
  {
    name: 'Valid Project.md',
    content: `# Project.md — Product PRD & Business Logic

## Purpose
This document represents the live Product Requirements Document (PRD) for the project.

## Draft Workflow
Any changes initiate a Project.md Draft following the sacred flow:
Draft → Validation → Task → Checkpoint → Review

All async operations in the workflow must handle failures gracefully with proper error handling and retry mechanisms.

## Draft Governance
There can only be one active Draft at any given time.
The Draft remains until all associated tasks are marked complete and approved by a human.

## Merge Policy
Only upon human-approved completion of all related tasks does the Draft merge into the Production Project.md.

## Error Handling
All system operations implement comprehensive error handling with structured logging and graceful recovery.`,
    shouldPass: true
  },
  {
    name: 'Bypass attempt',
    content: `# Project.md — Product PRD

## Quick Fix Process
We can bypass validation for urgent fixes.
Skip the normal flow when needed.`,
    shouldPass: false,
    expectedErrors: ['bypass', 'skip']
  },
  {
    name: 'Missing sacred flow',
    content: `# Project.md — Product PRD

## Draft Workflow
Changes go through: Draft → Task → Review → Validation`,
    shouldPass: false,
    expectedErrors: ['flow']
  },
  {
    name: 'Auto-merge without human approval',
    content: `# Project.md — Product PRD

## Merge Policy
System can auto-merge validated changes immediately.`,
    shouldPass: false,
    expectedErrors: ['human']
  },
  {
    name: 'Multiple active drafts',
    content: `# Project.md — Product PRD

## Draft Management
We support multiple active drafts for parallel development.
Each team can have their own active draft.`,
    shouldPass: false,
    expectedErrors: ['multiple', 'draft']
  },
  {
    name: 'Circular dependency',
    content: `# Project.md — Product PRD

## Dependencies
Task A depends on Task B.
Task B depends on Task A.`,
    shouldPass: false,
    expectedErrors: ['circular', 'dependency']
  },
  {
    name: 'Conflicting constraints',
    content: `# Project.md — Product PRD

## Performance Requirements
Page load time must be maximum 1 second.
Page load time must be minimum 5 seconds.`,
    shouldPass: false,
    expectedErrors: ['constraint', 'conflict']
  }
];

async function runTests() {
  console.log(chalk.blue('\n🧪 Running Project.md Validation Tests\n'));
  
  const workingDir = process.cwd();
  const validator = new ProjectValidator(workingDir);
  
  try {
    // Initialize validator
    await validator.initialize();
    
    let passed = 0;
    let failed = 0;
    
    // Run each test case
    for (const testCase of testCases) {
      console.log(chalk.gray(`\nTest: ${testCase.name}`));
      
      // Create temporary test file
      const testDir = join(workingDir, 'test-drafts');
      if (!existsSync(testDir)) {
        await mkdir(testDir, { recursive: true });
      }
      
      const testFile = join(testDir, `test-${Date.now()}.md`);
      await writeFile(testFile, testCase.content, 'utf-8');
      
      // Validate
      const result = await validator.validateDraft({
        id: testCase.name,
        content: testCase.content,
        validated: false,
        validationErrors: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const testPassed = result.valid === testCase.shouldPass;
      
      if (testPassed) {
        console.log(chalk.green(`  ✅ PASSED`));
        passed++;
      } else {
        console.log(chalk.red(`  ❌ FAILED`));
        console.log(chalk.red(`     Expected: ${testCase.shouldPass ? 'valid' : 'invalid'}`));
        console.log(chalk.red(`     Got: ${result.valid ? 'valid' : 'invalid'}`));
        
        if (result.errors.length > 0) {
          console.log(chalk.red(`     Errors:`));
          result.errors.forEach(error => {
            console.log(chalk.red(`       - ${error.message}`));
          });
        }
        
        if (testCase.expectedErrors) {
          const foundExpectedErrors = testCase.expectedErrors.every(expected =>
            result.errors.some(error => 
              error.message.toLowerCase().includes(expected.toLowerCase())
            )
          );
          
          if (!foundExpectedErrors) {
            console.log(chalk.red(`     Missing expected errors: ${testCase.expectedErrors.join(', ')}`));
          }
        }
        
        failed++;
      }
    }
    
    // Summary
    console.log(chalk.blue('\n📊 Test Summary'));
    console.log(chalk.green(`  ✅ Passed: ${passed}`));
    console.log(chalk.red(`  ❌ Failed: ${failed}`));
    console.log(chalk.blue(`  Total: ${passed + failed}`));
    
    if (failed === 0) {
      console.log(chalk.green('\n🎉 All tests passed!'));
      console.log(chalk.green('Uncle Frank says: "Now we\'re cooking with gas!"'));
    } else {
      console.log(chalk.red('\n😞 Some tests failed'));
      console.log(chalk.red('Uncle Frank says: "Back to the drawing board!"'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('Test execution failed:'), error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  runTests().catch(console.error);
}

export { runTests };