#!/usr/bin/env node

/**
 * FIXED INTELLIGENT AUTO-IMPROVE SYSTEM
 * Uses direct claude --print execution instead of tmux
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_DIR = '/tmp/unclefrank-bootstrap';

class IntelligentAutoImprove {
    constructor() {
        this.iteration = 0;
        this.targetDocs = {};
        this.currentImplementation = {};
        this.gaps = [];
        this.tasks = [];
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    async executeWithClaude(prompt) {
        this.log('🤖 Executing with Claude...');
        
        // Escape the prompt for shell
        const escapedPrompt = prompt.replace(/'/g, "'\\''");
        
        // Use claude --print --dangerously-skip-permissions for direct execution
        const command = `cd ${REPO_DIR} && claude --print --dangerously-skip-permissions '${escapedPrompt}'`;
        
        try {
            // NO TIMEOUT - let Claude work as long as it needs!
            const { stdout, stderr } = await execAsync(command, {
                maxBuffer: 50 * 1024 * 1024 // 50MB buffer for big responses
                // NO timeout property - Claude can take hours if needed
            });
            
            this.log('✅ Claude execution completed');
            return { success: true, output: stdout };
            
        } catch (error) {
            this.log(`❌ Claude execution failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async readTargetDocs() {
        this.log('📚 Reading target documentation...');
        
        const docsPath = path.join(REPO_DIR, 'docs to work towards');
        
        try {
            // Clone/update repo first
            if (!fs.existsSync(REPO_DIR)) {
                await execAsync(`git clone https://github.com/bhuman-ai/unclefrank-bootstrap.git ${REPO_DIR}`);
            } else {
                await execAsync(`cd ${REPO_DIR} && git pull origin master`);
            }
            
            // Read all docs in target folder
            if (fs.existsSync(docsPath)) {
                const files = fs.readdirSync(docsPath);
                for (const file of files) {
                    if (file.endsWith('.md')) {
                        const content = fs.readFileSync(path.join(docsPath, file), 'utf8');
                        this.targetDocs[file] = this.parseTargetDoc(content);
                        this.log(`  📄 Read ${file}: ${content.length} chars`);
                    }
                }
            }
        } catch (error) {
            this.log(`  ❌ Error reading docs: ${error.message}`);
        }
    }

    parseTargetDoc(content) {
        const parsed = {
            flows: [],
            endpoints: [],
            features: [],
            rules: []
        };

        // Extract flows
        const flowMatches = content.match(/(\w+)\s*→\s*(\w+)/g);
        if (flowMatches) parsed.flows = flowMatches;

        // Extract API endpoints
        const endpointMatches = content.match(/\/api\/[\w\/]+/g);
        if (endpointMatches) parsed.endpoints = [...new Set(endpointMatches)];

        // Extract features
        const featureMatches = content.match(/^[-•]\s+(.+)$/gm);
        if (featureMatches) {
            parsed.features = featureMatches.map(f => f.replace(/^[-•]\s+/, ''));
        }

        // Extract rules
        const ruleMatches = content.match(/.*\b(MUST|SHOULD|SHALL|REQUIRED)\b.*/gi);
        if (ruleMatches) parsed.rules = ruleMatches;

        return parsed;
    }

    async analyzeCurrentImplementation() {
        this.log('🔍 Analyzing current implementation...');
        
        try {
            const apiPath = path.join(REPO_DIR, 'pages/api');
            if (fs.existsSync(apiPath)) {
                this.currentImplementation.endpoints = this.scanDirectory(apiPath, '.js', '.ts');
            }

            const tasksPath = path.join(REPO_DIR, 'pages/api/tasks');
            this.currentImplementation.hasTaskSystem = fs.existsSync(tasksPath);

            const checkpointPath = path.join(REPO_DIR, 'pages/api/checkpoint');
            this.currentImplementation.hasCheckpointSystem = fs.existsSync(checkpointPath);

            const validatePath = path.join(REPO_DIR, 'pages/api/task/validate.js');
            this.currentImplementation.hasValidation = fs.existsSync(validatePath);

            this.log(`  📊 Found ${this.currentImplementation.endpoints?.length || 0} endpoints`);
            this.log(`  📊 Task system: ${this.currentImplementation.hasTaskSystem ? '✅' : '❌'}`);
            this.log(`  📊 Checkpoint system: ${this.currentImplementation.hasCheckpointSystem ? '✅' : '❌'}`);
            this.log(`  📊 Validation: ${this.currentImplementation.hasValidation ? '✅' : '❌'}`);
            
        } catch (error) {
            this.log(`  ❌ Error analyzing: ${error.message}`);
        }
    }

    scanDirectory(dir, ...extensions) {
        const results = [];
        
        function scan(currentDir, prefix = '') {
            if (!fs.existsSync(currentDir)) return;
            
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scan(fullPath, prefix + item + '/');
                } else if (extensions.some(ext => item.endsWith(ext))) {
                    results.push(prefix + item);
                }
            }
        }
        
        scan(dir);
        return results;
    }

    identifyGaps() {
        this.log('🎯 Identifying gaps...');
        this.gaps = [];

        for (const doc in this.targetDocs) {
            const target = this.targetDocs[doc];
            
            // Check missing endpoints
            for (const endpoint of target.endpoints || []) {
                const endpointFile = endpoint.replace('/api/', '') + '.js';
                const exists = this.currentImplementation.endpoints?.some(e => 
                    e.includes(endpointFile.replace(/\//g, '/'))
                );
                
                if (!exists) {
                    this.gaps.push({
                        type: 'missing_endpoint',
                        endpoint: endpoint,
                        fromDoc: doc,
                        priority: 1
                    });
                }
            }

            // Check missing features
            for (const feature of target.features || []) {
                if (feature.toLowerCase().includes('validation') && !this.currentImplementation.hasValidation) {
                    this.gaps.push({
                        type: 'missing_feature',
                        feature: feature,
                        fromDoc: doc,
                        priority: 2
                    });
                }
            }
        }

        this.gaps.sort((a, b) => a.priority - b.priority);
        this.log(`  🔍 Found ${this.gaps.length} gaps`);
    }

    async executeTask(task) {
        this.log(`🚀 Executing task: ${task.title}`);
        
        // FULL PROMPT - let Claude understand and implement properly!
        const prompt = `Analyze the unclefrank-bootstrap repository and implement the following:

${task.title}

Requirements:
${task.description}

Read any relevant documentation, understand the codebase structure, and implement this FULLY and PROPERLY. Take your time to do it right. Create all necessary files with complete functionality.`;

        const result = await this.executeWithClaude(prompt);
        
        if (result.success) {
            this.log('✅ Task executed successfully');
            return true;
        } else {
            this.log(`❌ Task failed: ${result.error}`);
            return false;
        }
    }

    async commitAndPush() {
        this.log('📤 Committing and pushing changes...');
        
        try {
            // Check for changes
            const { stdout: status } = await execAsync(`cd ${REPO_DIR} && git status --porcelain`);
            
            if (!status.trim()) {
                this.log('📝 No changes to commit');
                return false;
            }
            
            // Configure git
            await execAsync(`cd ${REPO_DIR} && git config user.name "Uncle Frank Bot"`);
            await execAsync(`cd ${REPO_DIR} && git config user.email "frank@unclefrank.ai"`);
            
            // Commit
            await execAsync(`cd ${REPO_DIR} && git add -A`);
            await execAsync(`cd ${REPO_DIR} && git commit -m "Auto-improve: Iteration ${this.iteration}

Fixed gaps using claude --print execution.
Found ${this.gaps.length} gaps and working on fixes.

Bot: Uncle Frank Intelligent Auto-Improve"`);
            
            // Push
            if (GITHUB_TOKEN) {
                await execAsync(`cd ${REPO_DIR} && git push https://${GITHUB_TOKEN}@github.com/bhuman-ai/unclefrank-bootstrap.git master`);
                this.log('✅ Pushed to GitHub! Check Vercel for deployment.');
                return true;
            } else {
                this.log('❌ No GITHUB_TOKEN found');
                return false;
            }
        } catch (error) {
            this.log(`❌ Git error: ${error.message}`);
            return false;
        }
    }

    async runIteration() {
        this.iteration++;
        this.log(`\n========== ITERATION ${this.iteration} ==========`);
        
        try {
            // Step 1: Read target docs
            await this.readTargetDocs();
            
            // Step 2: Analyze current implementation  
            await this.analyzeCurrentImplementation();
            
            // Step 3: Identify gaps
            this.identifyGaps();
            
            // Step 4: Execute top priority gap fix
            if (this.gaps.length > 0) {
                const topGap = this.gaps[0];
                const task = {
                    title: `Fix: ${topGap.type === 'missing_endpoint' ? topGap.endpoint : topGap.feature}`,
                    description: `Implement ${topGap.type === 'missing_endpoint' ? 'endpoint' : 'feature'} from ${topGap.fromDoc}`
                };
                
                const success = await this.executeTask(task);
                
                if (success) {
                    await this.commitAndPush();
                }
            }
            
            this.log(`📊 Iteration ${this.iteration} complete`);
            
        } catch (error) {
            this.log(`❌ Iteration error: ${error.message}`);
        }
    }

    async run() {
        this.log('🧠 FIXED INTELLIGENT AUTO-IMPROVE STARTING');
        this.log('✅ Using claude --print for direct execution');
        this.log('📦 No tmux dependency!');
        
        // Main loop
        while (true) {
            await this.runIteration();
            
            // Wait 5 minutes between iterations
            this.log('⏸️ Waiting 5 minutes before next iteration...');
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}

// Start the fixed system
const improver = new IntelligentAutoImprove();
improver.run().catch(console.error);