#!/usr/bin/env node

/**
 * AUTO-IMPROVE SYSTEM FOR FLY.IO - FIXED VERSION
 * Actually makes real code improvements using Claude API
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const REPO_URL = 'https://github.com/bhuman-ai/unclefrank-bootstrap.git';
const REPO_DIR = '/tmp/unclefrank-bootstrap';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

class AutoImproveFixed {
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

    async callClaude(prompt) {
        this.log('🤖 Calling Claude API...');
        
        if (!ANTHROPIC_API_KEY) {
            this.log('❌ No ANTHROPIC_API_KEY found');
            return null;
        }

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            const data = await response.json();
            if (data.content && data.content[0]) {
                return data.content[0].text;
            }
            return null;
        } catch (error) {
            this.log(`❌ Claude API error: ${error.message}`);
            return null;
        }
    }

    async analyzeAndImplement() {
        this.log('🔍 Analyzing codebase for improvements...');
        
        // Read target documentation
        const targetDocs = [];
        const docsPath = path.join(REPO_DIR, 'docs to work towards');
        
        if (fs.existsSync(docsPath)) {
            const docFiles = fs.readdirSync(docsPath);
            for (const file of docFiles.slice(0, 2)) {
                const content = fs.readFileSync(path.join(docsPath, file), 'utf8');
                targetDocs.push(`=== ${file} ===\n${content.substring(0, 1000)}`);
            }
        }

        // Read current implementation
        const apiPath = path.join(REPO_DIR, 'pages/api');
        const currentFiles = [];
        
        if (fs.existsSync(apiPath)) {
            const apiFiles = fs.readdirSync(apiPath).slice(0, 3);
            for (const file of apiFiles) {
                if (file.endsWith('.js')) {
                    const content = fs.readFileSync(path.join(apiPath, file), 'utf8');
                    currentFiles.push(`=== ${file} ===\n${content.substring(0, 500)}`);
                }
            }
        }

        const prompt = `You are Uncle Frank, implementing the checkpoint execution system.

TARGET ARCHITECTURE (from docs):
${targetDocs.join('\n\n')}

CURRENT IMPLEMENTATION:
${currentFiles.join('\n\n')}

Identify the #1 MOST CRITICAL missing piece and provide EXACT implementation.

Output ONLY in this format:
FILE_PATH: pages/api/[filename].js
IMPLEMENTATION:
[Complete working code]
END_IMPLEMENTATION`;

        const response = await this.callClaude(prompt);
        
        if (!response) {
            this.log('❌ No response from Claude');
            return false;
        }

        this.log(`📝 Claude response: ${response.substring(0, 200)}...`);

        // Parse response and implement
        const fileMatch = response.match(/FILE_PATH:\s*(.+)/);
        const codeMatch = response.match(/IMPLEMENTATION:\s*([\s\S]+?)END_IMPLEMENTATION/);
        
        if (fileMatch && codeMatch) {
            const filePath = path.join(REPO_DIR, fileMatch[1].trim());
            const code = codeMatch[1].trim();
            
            // Create directory if needed
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Write the file
            fs.writeFileSync(filePath, code);
            this.log(`✅ Created/updated: ${fileMatch[1]}`);
            
            return true;
        }
        
        this.log('⚠️ Could not parse Claude response');
        return false;
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
            
            // Commit
            await execAsync('git add -A');
            const message = `Auto-improve: Implement checkpoint system (iteration ${this.iteration})

Automated improvement from Fly.io server.
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
            
            // Analyze and implement improvements
            const hasChanges = await this.analyzeAndImplement();
            
            // Commit and push if we have changes
            if (hasChanges) {
                await this.commitAndPush();
            }
            
            this.log(`📊 Iteration ${this.iteration} complete`);
        } catch (error) {
            this.log(`❌ Iteration error: ${error.message}`);
        }
    }

    async run() {
        this.log('🚀 AUTO-IMPROVE SYSTEM (FIXED) STARTING ON FLY.IO');
        this.log('Will make REAL code improvements using Claude API');
        
        // Setup
        await this.setupGit();
        
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
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set!');
    console.error('Set it with: fly secrets set ANTHROPIC_API_KEY="sk-ant-..."');
    process.exit(1);
}

if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN not set!');
    console.error('Set it with: fly secrets set GITHUB_TOKEN="ghp_..."');
    process.exit(1);
}

// Start the system
const improver = new AutoImproveFixed();
improver.run().catch(console.error);