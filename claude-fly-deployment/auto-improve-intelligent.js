#!/usr/bin/env node

/**
 * INTELLIGENT AUTO-IMPROVE SYSTEM
 * Reads docs → Finds gaps → Creates tasks → Breaks into checkpoints → Executes
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const API_BASE = 'https://uncle-frank-claude.fly.dev';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

class IntelligentAutoImprove {
    constructor() {
        this.iteration = 0;
        this.sessionId = null;
        this.targetDocs = {};
        this.currentImplementation = {};
        this.gaps = [];
        this.tasks = [];
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    async makeRequest(path, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'uncle-frank-claude.fly.dev',
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                options.headers['Content-Length'] = JSON.stringify(data).length;
            }

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async createSession() {
        this.log('🔧 Creating new Claude session...');
        
        const response = await this.makeRequest('/api/sessions', 'POST', {
            name: `Intelligent Auto-improve #${this.iteration}`,
            workspace: '/tmp/unclefrank-bootstrap'
        });
        
        this.sessionId = response.sessionId;
        this.log(`✅ Session created: ${this.sessionId}`);
        return this.sessionId;
    }

    async readTargetDocs() {
        this.log('📚 Reading target documentation from "docs to work towards"...');
        
        const docsPath = '/tmp/unclefrank-bootstrap/docs to work towards';
        
        try {
            // Clone/update repo first
            if (!fs.existsSync('/tmp/unclefrank-bootstrap')) {
                await execAsync('git clone https://github.com/bhuman-ai/unclefrank-bootstrap.git /tmp/unclefrank-bootstrap');
            } else {
                await execAsync('cd /tmp/unclefrank-bootstrap && git pull');
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
            } else {
                this.log('  ⚠️ No "docs to work towards" folder found');
            }
        } catch (error) {
            this.log(`  ❌ Error reading docs: ${error.message}`);
        }
    }

    parseTargetDoc(content) {
        // Parse the target documentation to extract requirements
        const parsed = {
            flows: [],
            endpoints: [],
            features: [],
            rules: []
        };

        // Extract flows (e.g., Draft → Validation → Task → Checkpoint)
        const flowMatches = content.match(/(\w+)\s*→\s*(\w+)/g);
        if (flowMatches) {
            parsed.flows = flowMatches;
        }

        // Extract API endpoints mentioned
        const endpointMatches = content.match(/\/api\/[\w\/]+/g);
        if (endpointMatches) {
            parsed.endpoints = [...new Set(endpointMatches)];
        }

        // Extract features (lines starting with -)
        const featureMatches = content.match(/^[-•]\s+(.+)$/gm);
        if (featureMatches) {
            parsed.features = featureMatches.map(f => f.replace(/^[-•]\s+/, ''));
        }

        // Extract rules/requirements (lines with MUST, SHOULD, etc.)
        const ruleMatches = content.match(/.*\b(MUST|SHOULD|SHALL|REQUIRED)\b.*/gi);
        if (ruleMatches) {
            parsed.rules = ruleMatches;
        }

        return parsed;
    }

    async analyzeCurrentImplementation() {
        this.log('🔍 Analyzing current implementation...');
        
        const implPath = '/tmp/unclefrank-bootstrap';
        
        try {
            // Check what API endpoints exist
            const apiPath = path.join(implPath, 'pages/api');
            if (fs.existsSync(apiPath)) {
                this.currentImplementation.endpoints = this.scanDirectory(apiPath, '.js', '.ts');
            }

            // Check for task management system
            const tasksPath = path.join(implPath, 'pages/api/tasks');
            this.currentImplementation.hasTaskSystem = fs.existsSync(tasksPath);

            // Check for checkpoint system
            const checkpointPath = path.join(implPath, 'pages/api/checkpoint');
            this.currentImplementation.hasCheckpointSystem = fs.existsSync(checkpointPath);

            // Check for validation
            const validatePath = path.join(implPath, 'pages/api/task/validate.js');
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
        this.log('🎯 Identifying gaps between target and current...');
        this.gaps = [];

        // Check for missing endpoints from target docs
        for (const doc in this.targetDocs) {
            const target = this.targetDocs[doc];
            
            // Check each target endpoint
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
                        priority: this.calculatePriority(endpoint)
                    });
                }
            }

            // Check for missing flows
            for (const flow of target.flows || []) {
                if (flow.includes('Task') && !this.currentImplementation.hasTaskSystem) {
                    this.gaps.push({
                        type: 'missing_system',
                        system: 'Task Management',
                        fromDoc: doc,
                        priority: 1
                    });
                }
                if (flow.includes('Checkpoint') && !this.currentImplementation.hasCheckpointSystem) {
                    this.gaps.push({
                        type: 'missing_system',
                        system: 'Checkpoint Execution',
                        fromDoc: doc,
                        priority: 1
                    });
                }
            }

            // Check for missing features
            for (const feature of target.features || []) {
                // This is where we'd do more sophisticated gap analysis
                // For now, just track them
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

        // Sort gaps by priority
        this.gaps.sort((a, b) => a.priority - b.priority);
        
        this.log(`  🔍 Found ${this.gaps.length} gaps`);
        for (const gap of this.gaps.slice(0, 5)) {
            this.log(`    - ${gap.type}: ${gap.endpoint || gap.system || gap.feature}`);
        }
    }

    calculatePriority(endpoint) {
        // Core endpoints get higher priority
        if (endpoint.includes('task')) return 1;
        if (endpoint.includes('checkpoint')) return 1;
        if (endpoint.includes('validate')) return 2;
        if (endpoint.includes('draft')) return 2;
        if (endpoint.includes('project')) return 3;
        return 4;
    }

    generateTasksFromGaps() {
        this.log('📝 Generating tasks from gaps...');
        this.tasks = [];

        for (const gap of this.gaps.slice(0, 5)) { // Process top 5 gaps
            if (gap.type === 'missing_endpoint') {
                this.tasks.push({
                    title: `Create ${gap.endpoint} endpoint`,
                    description: `Implement the ${gap.endpoint} API endpoint as specified in ${gap.fromDoc}`,
                    acceptanceCriteria: [
                        `Endpoint exists at ${gap.endpoint}`,
                        'Returns proper JSON responses',
                        'Handles errors appropriately',
                        'Follows Uncle Frank personality'
                    ],
                    checkpoints: this.generateCheckpoints(gap)
                });
            } else if (gap.type === 'missing_system') {
                this.tasks.push({
                    title: `Implement ${gap.system}`,
                    description: `Build the ${gap.system} as specified in ${gap.fromDoc}`,
                    acceptanceCriteria: [
                        `${gap.system} is functional`,
                        'Integrates with existing systems',
                        'Has proper error handling'
                    ],
                    checkpoints: this.generateCheckpoints(gap)
                });
            } else if (gap.type === 'missing_feature') {
                // Handle missing features - especially validation
                const featureTitle = gap.feature.length > 50 ? 
                    gap.feature.substring(0, 47) + '...' : gap.feature;
                
                this.tasks.push({
                    title: `Implement: ${featureTitle}`,
                    description: `Implement feature from ${gap.fromDoc}: ${gap.feature}`,
                    acceptanceCriteria: [
                        'Feature is fully functional',
                        'Follows Uncle Frank specification',
                        'Has proper error handling',
                        'Integrates with existing system'
                    ],
                    checkpoints: this.generateCheckpoints(gap)
                });
            }
        }

        this.log(`  📋 Generated ${this.tasks.length} tasks`);
    }

    generateCheckpoints(gap) {
        const checkpoints = [];
        
        if (gap.type === 'missing_endpoint') {
            checkpoints.push({
                id: `create-file-${gap.endpoint}`,
                description: `Create file for ${gap.endpoint}`,
                test: `File exists at pages/api${gap.endpoint.replace('/api', '')}.js`,
                passCriteria: 'File exists'
            });
            
            checkpoints.push({
                id: `implement-handler-${gap.endpoint}`,
                description: `Implement handler function`,
                test: `Handler exports default async function`,
                passCriteria: 'Function is exported'
            });
            
            checkpoints.push({
                id: `test-endpoint-${gap.endpoint}`,
                description: `Test endpoint responds`,
                test: `curl -X POST ${gap.endpoint} returns 200 or 405`,
                passCriteria: 'Returns valid HTTP response'
            });
        } else if (gap.type === 'missing_system' || gap.type === 'missing_feature') {
            // Generic checkpoints for features/systems
            const featureId = (gap.feature || gap.system || 'feature').replace(/[^a-z0-9]/gi, '-').toLowerCase();
            
            checkpoints.push({
                id: `analyze-${featureId}`,
                description: `Analyze requirements for ${gap.feature || gap.system}`,
                test: `Requirements understood and documented`,
                passCriteria: 'Analysis complete'
            });
            
            checkpoints.push({
                id: `implement-${featureId}`,
                description: `Implement ${gap.feature || gap.system}`,
                test: `Feature/system implemented and working`,
                passCriteria: 'Implementation complete'
            });
            
            checkpoints.push({
                id: `test-${featureId}`,
                description: `Test ${gap.feature || gap.system}`,
                test: `All tests pass for the feature`,
                passCriteria: 'Tests pass'
            });
            
            checkpoints.push({
                id: `integrate-${featureId}`,
                description: `Integrate with existing systems`,
                test: `Feature works with existing code`,
                passCriteria: 'Integration successful'
            });
        }
        
        return checkpoints;
    }

    async createTaskInSystem(task) {
        this.log(`🔨 Creating task in Uncle Frank system: ${task.title}`);
        
        // Use Claude to create the actual task with all details
        const prompt = `
Create a new task in the Uncle Frank task management system:

Title: ${task.title}
Description: ${task.description}
Acceptance Criteria:
${task.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}

Checkpoints:
${task.checkpoints.map(cp => `- ${cp.id}: ${cp.description} (Test: ${cp.test})`).join('\n')}

Create the necessary files:
1. Create task file at pages/api/tasks/create.js if it doesn't exist
2. Add this task to the task queue
3. Set up checkpoint definitions
4. Make it ready for execution

Actually create the working implementation.`;

        await this.makeRequest(`/api/sessions/${this.sessionId}/execute`, 'POST', {
            message: prompt
        });
    }

    async executeTopPriorityTask() {
        if (this.tasks.length === 0) {
            this.log('📭 No tasks to execute');
            return false;
        }

        const task = this.tasks[0];
        this.log(`🚀 Executing top priority task: ${task.title}`);
        
        // Create the task in the system
        await this.createTaskInSystem(task);
        
        // Wait for completion
        return await this.waitForCompletion();
    }

    async waitForCompletion() {
        this.log('⏳ Waiting for task completion...');
        
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes
        
        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000));
            
            const status = await this.makeRequest(`/api/sessions/${this.sessionId}/status`);
            
            if (status.status !== 'processing') {
                if (status.status === 'completed') {
                    this.log('✅ Task completed!');
                    return true;
                } else if (status.status === 'error') {
                    this.log(`❌ Task failed: ${status.error}`);
                    return false;
                }
            }
            
            attempts++;
            if (attempts % 12 === 0) {
                this.log(`Still processing... (${attempts * 5} seconds)`);
            }
        }
        
        this.log('⏰ Task timed out');
        return false;
    }

    async commitAndPush() {
        this.log('📤 Committing and pushing changes...');
        
        try {
            const repoPath = '/tmp/unclefrank-bootstrap';
            
            // Check for changes
            const { stdout: status } = await execAsync(`cd ${repoPath} && git status --porcelain`);
            
            if (!status.trim()) {
                this.log('📝 No changes to commit');
                return false;
            }
            
            // Commit
            await execAsync(`cd ${repoPath} && git add -A`);
            await execAsync(`cd ${repoPath} && git commit -m "Intelligent auto-improve: ${this.tasks[0]?.title || 'Gap fixes'}

Automated gap analysis and implementation.
- Analyzed target docs vs current implementation
- Found ${this.gaps.length} gaps
- Implemented top priority items

Iteration: ${this.iteration}
Bot: Uncle Frank Intelligent Auto-Improve"`);
            
            // Push
            if (GITHUB_TOKEN) {
                await execAsync(`cd ${repoPath} && git push https://${GITHUB_TOKEN}@github.com/bhuman-ai/unclefrank-bootstrap.git master`);
                this.log('✅ Pushed to GitHub!');
                return true;
            } else {
                this.log('⚠️ No GITHUB_TOKEN - cannot push');
                return false;
            }
        } catch (error) {
            this.log(`❌ Git error: ${error.message}`);
            return false;
        }
    }

    async runIteration() {
        this.iteration++;
        this.log(`\n========== INTELLIGENT ITERATION ${this.iteration} ==========`);
        
        try {
            // Step 1: Read target docs
            await this.readTargetDocs();
            
            // Step 2: Analyze current implementation
            await this.analyzeCurrentImplementation();
            
            // Step 3: Identify gaps
            this.identifyGaps();
            
            // Step 4: Generate tasks from gaps
            this.generateTasksFromGaps();
            
            // Step 5: Create Claude session
            await this.createSession();
            
            // Step 6: Execute top priority task
            const success = await this.executeTopPriorityTask();
            
            // Step 7: Commit and push if successful
            if (success) {
                await this.commitAndPush();
            }
            
            this.log(`📊 Iteration ${this.iteration} complete`);
            this.log(`📊 Remaining gaps: ${this.gaps.length}`);
            
        } catch (error) {
            this.log(`❌ Iteration error: ${error.message}`);
        }
    }

    async run() {
        this.log('🧠 INTELLIGENT AUTO-IMPROVE SYSTEM STARTING');
        this.log('Will analyze docs → find gaps → create tasks → execute');
        
        // Main loop
        while (true) {
            await this.runIteration();
            
            // Wait 5 minutes between iterations
            this.log('⏸️ Waiting 5 minutes before next iteration...');
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}

// Start the intelligent system
const improver = new IntelligentAutoImprove();
improver.run().catch(console.error);