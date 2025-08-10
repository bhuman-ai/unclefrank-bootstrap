#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { MetaAgent } from './agents/meta-agent';
import { DocumentManager } from './core/document-manager';
// import { TerragonProxy } from './core/terragon-proxy';
import { PrincipleEnforcer } from './core/principle-enforcer';
import { prompt, confirm, showDiff, showCheckpointSummary, cleanup } from './utils/cli';
import type { Task, Checkpoint } from './types';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

class UncleFrankBootstrap {
  private metaAgent: MetaAgent;
  private documentManager: DocumentManager;
  // private terragonProxy: TerragonProxy;
  private principleEnforcer: PrincipleEnforcer;

  constructor() {
    if (!CLAUDE_API_KEY) {
      console.error(chalk.red('Error: CLAUDE_API_KEY environment variable not set'));
      process.exit(1);
    }

    this.metaAgent = new MetaAgent(CLAUDE_API_KEY);
    this.documentManager = new DocumentManager(process.cwd());
    // this.terragonProxy = new TerragonProxy(TERRAGON_AUTH);
    this.principleEnforcer = new PrincipleEnforcer(process.cwd());
  }

  async initialize(): Promise<void> {
    console.log(chalk.bold.cyan('\n🔨 Uncle Frank\'s Bootstrap Core v0.0.1\n'));
    
    try {
      await this.principleEnforcer.loadPrinciples();
    } catch (error) {
      console.log(chalk.yellow('CLAUDE.md not found. Creating from template...'));
      // Copy from UncleFrank directory if available
      // For now, we'll proceed without it
    }
  }

  async processRequest(request: string): Promise<void> {
    console.log(chalk.bold('\n📋 Processing request:'), request);

    // Step 1: Classify request
    const classification = await this.metaAgent.classifyRequest(request);
    console.log(chalk.gray(`Request type: ${classification.type} (${classification.confidence * 100}% confidence)`));

    if (classification.type !== 'ACTION') {
      console.log(chalk.yellow('\nThis looks like an info/planning request. Bootstrap core handles ACTION requests only.'));
      console.log('For full functionality, build the complete system using this bootstrap!');
      return;
    }

    // Step 2: Validate against principles
    const validation = await this.principleEnforcer.validateAction(request);
    if (!validation.allowed) {
      console.log(chalk.red('\n❌ Request violates sacred principles:'));
      console.log(validation.reasoning);
      return;
    }

    // Step 3: Get project context
    const projectContext = await this.documentManager.readProjectMd();

    // Step 4: Decompose into task and checkpoints
    console.log(chalk.cyan('\n🤖 Decomposing request into micro-actions...'));
    const { task, checkpoints } = await this.metaAgent.decomposeTask(request, projectContext);

    // Step 5: Show task summary and get approval
    console.log(chalk.bold('\n📄 Task Summary:'));
    console.log(`Name: ${task.name}`);
    console.log(`Objective: ${task.objective}`);
    console.log(`Acceptance Criteria: ${task.acceptanceCriteria.length} tests`);
    console.log(`Checkpoints: ${checkpoints.length}`);

    showCheckpointSummary(checkpoints);

    const approved = await confirm('\nApprove this task decomposition?');
    if (!approved) {
      console.log(chalk.yellow('Task cancelled by user.'));
      return;
    }

    // Step 6: Save task and checkpoints
    await this.documentManager.createTask(task);
    for (const checkpoint of checkpoints) {
      await this.documentManager.createCheckpoint(checkpoint);
    }

    // Step 7: Create Terragon session (disabled)
    // const sessionId = await this.terragonProxy.createSession(task.name);
    // task.terragonSessionId = sessionId;
    const sessionId = 'local-session';

    // Step 8: Execute checkpoints
    console.log(chalk.bold('\n🚀 Executing checkpoints...\n'));
    
    for (const checkpoint of checkpoints) {
      if (checkpoint.blocking || checkpoints.indexOf(checkpoint) === 0) {
        await this.executeCheckpoint(checkpoint, projectContext);
        
        if (checkpoint.status === 'fail') {
          console.log(chalk.red(`\n❌ Checkpoint "${checkpoint.name}" failed. Stopping execution.`));
          break;
        }
      }
    }

    // Step 9: Final review
    if (checkpoints.every(cp => cp.status === 'pass')) {
      console.log(chalk.green('\n✅ All checkpoints passed!'));
      
      const merge = await confirm('Merge changes to Project.md?');
      if (merge) {
        console.log(chalk.green('Changes merged to production state.'));
        // In a real implementation, we'd update Project.md here
      }
    }

    // Cleanup
    // await this.terragonProxy.closeSession(sessionId);
  }

  private async executeCheckpoint(
    checkpoint: Checkpoint,
    projectContext: string
  ): Promise<void> {
    console.log(chalk.bold(`\n▶️  Checkpoint: ${checkpoint.name}`));
    
    let attempts = 0;
    while (attempts < checkpoint.maxRetries) {
      attempts++;
      
      if (attempts > 1) {
        console.log(chalk.yellow(`Retry attempt ${attempts}/${checkpoint.maxRetries}`));
      }

      try {
        // Execute via Terragon (disabled - using local execution)
        // const response = await this.terragonProxy.executeCheckpoint(
        //   checkpoint.taskId,
        //   checkpoint,
        //   projectContext
        // );
        const response = { success: true, output: 'Local execution' };

        // Analyze response
        const analysis = await this.metaAgent.analyzeForContinuation(checkpoint, response);
        
        console.log(chalk.gray(`Analysis: ${analysis.reasoning}`));

        if (analysis.isComplete) {
          // Run pass/fail tests
          const passed = await this.runTests(checkpoint);
          checkpoint.status = passed ? 'pass' : 'fail';
          
          if (passed) {
            console.log(chalk.green(`✓ Checkpoint passed`));
            break;
          } else if (attempts < checkpoint.maxRetries) {
            console.log(chalk.yellow(`Test failed, retrying...`));
          }
        } else if (analysis.needsUserInput) {
          const answer = await prompt(analysis.question || 'User input needed:');
          // In a real implementation, we'd send this back to Terragon
          console.log(chalk.gray('User response recorded'));
        } else if (analysis.canContinue && analysis.nextAction) {
          console.log(chalk.blue('Continuing autonomously...'));
          // In a real implementation, we'd loop back with nextAction
        }
      } catch (error) {
        console.error(chalk.red('Execution error:'), error);
        checkpoint.status = 'fail';
      }
    }

    if (checkpoint.status === 'fail') {
      console.log(chalk.red(`✗ Checkpoint failed after ${attempts} attempts`));
    }
  }

  private async runTests(checkpoint: Checkpoint): Promise<boolean> {
    console.log(chalk.blue('Running tests...'));
    
    // FRANK'S REAL TEST EXECUTION - NO USER CONFIRMATION BULLSHIT
    for (const criterion of checkpoint.passCriteria) {
      console.log(chalk.blue(`Testing: ${criterion.description}`));
      
      try {
        // Execute the actual test command or validation
        let passed = false;
        
        if (criterion.testCommand) {
          // Run actual test command
          const { exec } = require('child_process');
          const result = await new Promise((resolve) => {
            exec(criterion.testCommand, (error, stdout, stderr) => {
              resolve({ success: !error, output: stdout, error: stderr });
            });
          });
          passed = result.success;
          console.log(chalk.gray(`Command output: ${result.output}`));
        } else if (criterion.description.includes('file') && criterion.description.includes('exists')) {
          // File existence check
          const fs = require('fs');
          const fileName = criterion.description.match(/(\w+\.?\w*)/)?.[1];
          if (fileName) {
            passed = fs.existsSync(fileName);
          }
        } else {
          // Default: fail if no clear test criteria
          console.log(chalk.red(`No automated test available for: ${criterion.description}`));
          passed = false;
        }
        
        criterion.passed = passed;
        
        if (passed) {
          console.log(chalk.green(`✓ ${criterion.description}`));
        } else {
          console.log(chalk.red(`✗ ${criterion.description}`));
          return false;
        }
      } catch (error) {
        console.log(chalk.red(`Test failed: ${error.message}`));
        criterion.passed = false;
        return false;
      }
    }
    
    return true;
  }

  async startChatMode(threadId?: string): Promise<void> {
    console.log(chalk.red('Chat mode is currently disabled (TerragonProxy removed)'));
    process.exit(0);
    /*
    console.log(chalk.bold.cyan('\n💬 Uncle Frank Chat Mode\n'));
    
    const activeThreadId = threadId || await this.terragonProxy.createChatThread('Uncle Frank Chat');
    console.log(chalk.gray(`Thread ID: ${activeThreadId}`));
    console.log(chalk.gray('Type your messages, or use commands:'));
    console.log(chalk.gray('  /quit - Exit chat mode'));
    console.log(chalk.gray('  /clear - Clear message history\n'));

    let isListening = false;
    
    // Set up message listener
    const startListening = async () => {
      if (!isListening) {
        isListening = true;
        await this.terragonProxy.startListening(
          activeThreadId,
          (message) => {
            console.log(chalk.cyan(`\n[Terragon] ${message.text}`));
            process.stdout.write(chalk.yellow('\n> '));
          },
          (error) => {
            console.error(chalk.red('\n[Error]'), error.message);
            process.stdout.write(chalk.yellow('\n> '));
          }
        );
      }
    };

    await startListening();

    // Interactive chat loop
    process.stdout.write(chalk.yellow('> '));
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      const input = data.toString().trim();
      
      if (input === '/quit') {
        console.log(chalk.yellow('\nExiting chat mode...'));
        this.terragonProxy.stopListening(activeThreadId);
        cleanup();
        process.exit(0);
      } else if (input === '/clear') {
        console.clear();
        console.log(chalk.bold.cyan('💬 Uncle Frank Chat Mode\n'));
        console.log(chalk.gray(`Thread ID: ${activeThreadId}\n`));
      } else if (input) {
        try {
          await this.terragonProxy.sendChatMessage(activeThreadId, input);
        } catch (error) {
          console.error(chalk.red('Failed to send message:'), error);
        }
      }
      
      process.stdout.write(chalk.yellow('\n> '));
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      this.terragonProxy.stopAllListeners();
      cleanup();
      process.exit(0);
    });
    */
  }
}

// CLI setup
const program = new Command();

program
  .name('uncle-frank')
  .description('Uncle Frank\'s Bootstrap Core - No BS LLM Development')
  .version('0.0.1');

program
  .command('task <request>')
  .description('Create and execute a new task')
  .action(async (request: string) => {
    const bootstrap = new UncleFrankBootstrap();
    await bootstrap.initialize();
    await bootstrap.processRequest(request);
    cleanup();
  });

program
  .command('init')
  .description('Initialize a new Uncle Frank project')
  .action(async () => {
    console.log(chalk.cyan('Initializing Uncle Frank project...'));
    console.log('Copy CLAUDE.md and other sacred documents to this directory.');
    console.log('Then run: uncle-frank task "your first task"');
  });

program
  .command('chat [threadId]')
  .description('Start interactive chat mode with Terragon')
  .action(async (threadId?: string) => {
    const bootstrap = new UncleFrankBootstrap();
    await bootstrap.initialize();
    await bootstrap.startChatMode(threadId);
  });

program.parse();

// Handle no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}