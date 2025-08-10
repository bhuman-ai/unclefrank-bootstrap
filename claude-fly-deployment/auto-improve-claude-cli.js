#!/usr/bin/env node

/**
 * AUTO-IMPROVE SYSTEM FOR FLY.IO - USING CLAUDE CODE CLI
 * Uses the Claude Code CLI that's already installed on Fly.io
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const REPO_URL = 'https://github.com/bhuman-ai/unclefrank-bootstrap.git';
const REPO_DIR = '/tmp/unclefrank-bootstrap';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

class AutoImproveClaudeCLI {
    constructor() {
        this.iteration = 0;
        this.logFile = '/tmp/auto-improve.log';
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] ${message}`;
        console.log(logMsg);
        fs.appendFileSync(this.logFile, logMsg + '\n');
    }

    async setupGit() {
        this.log('🔧 Setting up Git...');
        await execAsync('git config --global user.name "Uncle Frank Bot"');
        await execAsync('git config --global user.email "frank@unclefrank.ai"');
        
        if (GITHUB_TOKEN) {
            await execAsync('git config --global credential.helper store');
            fs.writeFileSync(
                `${process.env.HOME}/.git-credentials`,
                `https://${GITHUB_TOKEN}@github.com\n`
            );
            this.log('✅ Git configured with token');
        }
    }

    async cloneOrUpdateRepo() {
        if (fs.existsSync(REPO_DIR)) {
            this.log('📥 Updating repository...');
            await execAsync(`cd ${REPO_DIR} && git pull origin master`);
        } else {
            this.log('📥 Cloning repository...');
            await execAsync(`git clone ${REPO_URL} ${REPO_DIR}`);
        }
    }

    async callClaudeCLI(prompt) {
        this.log('🤖 Calling Claude Code CLI...');
        
        // Escape the prompt for shell
        const escapedPrompt = prompt.replace(/'/g, "'\\''");
        
        try {
            // Use Claude Code CLI with --print to get output
            const command = `cd ${REPO_DIR} && claude --dangerously-skip-permissions --print '${escapedPrompt}'`;
            const { stdout, stderr } = await execAsync(command, { 
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                timeout: 120000 // 2 minute timeout
            });
            
            if (stderr) {
                this.log(`⚠️ Claude stderr: ${stderr}`);
            }
            
            return stdout;
        } catch (error) {
            this.log(`❌ Claude CLI error: ${error.message}`);
            return null;
        }
    }

    async analyzeAndImplement() {
        this.log('🔍 Analyzing codebase for improvements...');
        
        // Build the prompt for Claude
        const prompt = `You are Uncle Frank implementing the checkpoint execution system.

Look at the target documentation in 'docs to work towards/' directory.
Compare it with the current implementation in 'pages/api/'.

Your job:
1. Find the #1 MOST CRITICAL missing API endpoint
2. Create a complete working implementation

Focus on these endpoints in priority order:
- /api/checkpoint/execute - Execute checkpoints with Pass/Fail
- /api/task/validate - Validate tasks before execution
- /api/project/draft - Handle draft updates to Project.md

Pick ONE endpoint that doesn't exist yet and create it.
Write the COMPLETE working code to pages/api/[endpoint].js

Use these patterns:
- export default async function handler(req, res)
- Proper error handling
- JSON responses
- Uncle Frank personality in comments

GO! Create the file now.`;

        const response = await this.callClaudeCLI(prompt);
        
        if (!response) {
            this.log('❌ No response from Claude CLI');
            return false;
        }

        this.log(`📝 Claude created/modified files`);
        return true;
    }

    async commitAndPush() {
        try {
            process.chdir(REPO_DIR);
            
            // Check for changes
            const { stdout: status } = await execAsync('git status --porcelain');
            if (!status.trim()) {
                this.log('📝 No changes to commit');
                return false;
            }
            
            this.log(`📋 Changes detected:\n${status}`);
            
            // Show what changed
            const { stdout: diff } = await execAsync('git diff --stat');
            this.log(`📊 Change summary:\n${diff}`);
            
            // Commit
            await execAsync('git add -A');
            const message = `Auto-improve: Implement checkpoint system (iteration ${this.iteration})

Automated improvement from Fly.io using Claude Code CLI.
Following Uncle Frank's development constitution.

Bot: Uncle Frank Auto-Improve`;
            
            await execAsync(`git commit -m "${message}"`);
            this.log('💾 Changes committed');
            
            // Push
            await execAsync('git push origin master');
            this.log('✅ Pushed to GitHub');
            this.log('🌐 Vercel will auto-deploy in ~2 minutes');
            
            return true;
        } catch (error) {
            this.log(`❌ Git error: ${error.message}`);
            return false;
        }
    }

    async runIteration() {
        this.iteration++;
        this.log(`\n========== ITERATION ${this.iteration} ==========`);
        
        try {
            // Update repo
            await this.cloneOrUpdateRepo();
            
            // Change to repo directory for Claude to work in
            process.chdir(REPO_DIR);
            
            // Analyze and implement improvements
            await this.analyzeAndImplement();
            
            // Always try to commit and push (Claude may have made changes)
            await this.commitAndPush();
            
            this.log(`📊 Iteration ${this.iteration} complete`);
        } catch (error) {
            this.log(`❌ Iteration error: ${error.message}`);
        }
    }

    async run() {
        this.log('🚀 AUTO-IMPROVE SYSTEM (CLAUDE CLI) STARTING ON FLY.IO');
        this.log('Will make REAL code improvements using Claude Code CLI');
        
        // Setup
        await this.setupGit();
        
        // Test Claude CLI is available
        try {
            const { stdout } = await execAsync('claude --version');
            this.log(`✅ Claude Code CLI available: ${stdout.trim()}`);
        } catch (error) {
            this.log('❌ Claude Code CLI not found! Installing may be needed.');
        }
        
        // Main loop
        while (true) {
            await this.runIteration();
            
            // Wait 5 minutes between iterations
            this.log('⏸️ Waiting 5 minutes before next iteration...');
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}

// Check for required environment variables
if (!process.env.GITHUB_TOKEN) {
    console.error('⚠️ GITHUB_TOKEN not set!');
    console.error('Set it with: fly secrets set GITHUB_TOKEN="ghp_..."');
}

// Start the system
const improver = new AutoImproveClaudeCLI();
improver.run().catch(console.error);