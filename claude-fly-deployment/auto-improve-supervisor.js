#!/usr/bin/env node

/**
 * AUTO-IMPROVE SUPERVISOR FOR FLY.IO
 * Runs the improvement loop continuously on Fly.io
 * Pulls from GitHub, makes improvements, pushes back
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const REPO_URL = 'https://github.com/bhuman-ai/unclefrank-bootstrap.git';
const REPO_DIR = '/tmp/unclefrank-bootstrap';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

class AutoImproveFlyio {
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

    async analyzeGaps() {
        this.log('🔴 Analyzing gaps with Claude...');
        
        // Read target docs
        const targetDocs = [
            'docs to work towards/claude.md',
            'docs to work towards/task.md'
        ].map(doc => {
            const docPath = path.join(REPO_DIR, doc);
            if (fs.existsSync(docPath)) {
                return fs.readFileSync(docPath, 'utf8').substring(0, 1000);
            }
            return '';
        }).join('\n---\n');

        // Send to Claude via tmux
        const prompt = `Analyze gaps between target docs and current implementation.
Target: Immutable flow (Draft → Validation → Task → Checkpoint → Review → Merge)
Current: Check /tmp/unclefrank-bootstrap/pages/api/

Find #1 CRITICAL missing feature. Output:
FILE: [path]
CODE: [implementation]`;

        try {
            // Use tmux to interact with Claude
            await execAsync(`tmux send-keys -t claude-manual C-c`);
            await new Promise(r => setTimeout(r, 500));
            
            await execAsync(`tmux send-keys -t claude-manual "${prompt}" Enter`);
            await new Promise(r => setTimeout(r, 5000));
            
            // Capture response
            const { stdout } = await execAsync('tmux capture-pane -t claude-manual -p | tail -30');
            this.log(`Claude response: ${stdout.substring(0, 200)}...`);
            
            return stdout;
        } catch (error) {
            this.log(`Error analyzing: ${error.message}`);
            return null;
        }
    }

    async implementFix(analysis) {
        if (!analysis) return false;
        
        this.log('🔨 Implementing fix...');
        
        // For now, create a simple improvement
        const timestamp = new Date().toISOString();
        const improvementFile = path.join(REPO_DIR, 'improvements.log');
        
        const improvement = `
Iteration ${this.iteration} - ${timestamp}
Analysis: ${analysis.substring(0, 200)}
Status: Analyzed
`;
        
        fs.appendFileSync(improvementFile, improvement);
        
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
            
            // Commit
            await execAsync('git add -A');
            const message = `Auto-improve: Iteration ${this.iteration} (Fly.io)

Automated improvement from Fly.io server.
Continuous improvement system.

Bot: Uncle Frank Auto-Improve`;
            
            await execAsync(`git commit -m "${message}"`);
            this.log('💾 Changes committed');
            
            // Push
            await execAsync('git push origin master');
            this.log('✅ Pushed to GitHub');
            this.log('🌐 Vercel will deploy in ~2 minutes');
            
            return true;
        } catch (error) {
            this.log(`❌ Git error: ${error.message}`);
            return false;
        }
    }

    async runIteration() {
        this.iteration++;
        this.log(`\n========== ITERATION ${this.iteration} ==========`);
        
        // Update repo
        await this.cloneOrUpdateRepo();
        
        // Analyze gaps
        const analysis = await this.analyzeGaps();
        
        // Implement fix
        const hasChanges = await this.implementFix(analysis);
        
        // Commit and push
        if (hasChanges) {
            await this.commitAndPush();
        }
        
        this.log(`📊 Iteration ${this.iteration} complete`);
    }

    async run() {
        this.log('🚀 AUTO-IMPROVE SYSTEM STARTING ON FLY.IO');
        this.log('Will run continuously even when your computer is off');
        
        // Setup
        await this.setupGit();
        
        // Main loop
        while (true) {
            try {
                await this.runIteration();
            } catch (error) {
                this.log(`❌ Iteration error: ${error.message}`);
            }
            
            // Wait 2 minutes
            this.log('⏸️ Waiting 2 minutes...');
            await new Promise(resolve => setTimeout(resolve, 120000));
        }
    }
}

// Start the system
const improver = new AutoImproveFlyio();
improver.run().catch(console.error);