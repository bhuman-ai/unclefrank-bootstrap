#!/usr/bin/env node

/**
 * UNCLE FRANK AUTO-IMPROVE SYSTEM
 * Creates tasks in the Uncle Frank task management system
 * Based on gaps between docs-future and current reality
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);
const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_DIR = '/tmp/unclefrank-bootstrap';
const API_BASE_URL = process.env.API_BASE_URL || 'https://unclefrank-bootstrap.vercel.app';

class UncleFrankAutoImprove {
    constructor() {
        this.iteration = 0;
        this.futureSpecs = {};
        this.currentSpecs = {};
        this.actualImplementation = {};
        this.gaps = [];
        this.tasksCreated = [];
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    async cloneOrUpdateRepo() {
        this.log('📦 Syncing repository...');
        
        try {
            if (!fs.existsSync(REPO_DIR)) {
                await execAsync(`git clone https://github.com/bhuman-ai/unclefrank-bootstrap.git ${REPO_DIR}`);
                this.log('✅ Repository cloned');
            } else {
                await execAsync(`cd ${REPO_DIR} && git pull origin master`);
                this.log('✅ Repository updated');
            }
        } catch (error) {
            this.log(`❌ Git sync error: ${error.message}`);
        }
    }

    async readDocsFuture() {
        this.log('📚 Reading docs-future specifications...');
        this.futureSpecs = {};
        
        const docsPath = path.join(REPO_DIR, 'docs-future');
        
        if (!fs.existsSync(docsPath)) {
            this.log('⚠️  docs-future folder not found');
            return;
        }
        
        const files = fs.readdirSync(docsPath);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const content = fs.readFileSync(path.join(docsPath, file), 'utf8');
                this.futureSpecs[file] = this.parseSpecification(content);
                this.log(`  📄 Read ${file}: ${content.length} chars`);
            }
        }
    }

    async readDocsCurrent() {
        this.log('📚 Reading docs-current state...');
        this.currentSpecs = {};
        
        const docsPath = path.join(REPO_DIR, 'docs-current');
        
        if (!fs.existsSync(docsPath)) {
            this.log('⚠️  docs-current folder not found');
            return;
        }
        
        const files = fs.readdirSync(docsPath);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const content = fs.readFileSync(path.join(docsPath, file), 'utf8');
                this.currentSpecs[file] = this.parseSpecification(content);
                this.log(`  📄 Read ${file}: ${content.length} chars`);
            }
        }
    }

    parseSpecification(content) {
        const spec = {
            endpoints: [],
            features: [],
            components: [],
            requirements: []
        };

        // Extract API endpoints
        const endpointMatches = content.match(/`?(GET|POST|PUT|DELETE|PATCH)\s+\/api\/[^\s`]+`?/g);
        if (endpointMatches) {
            spec.endpoints = [...new Set(endpointMatches.map(e => e.replace(/`/g, '')))];
        }

        // Extract features (lines starting with - or *)
        const featureMatches = content.match(/^[\-\*]\s+(.+)$/gm);
        if (featureMatches) {
            spec.features = featureMatches.map(f => f.replace(/^[\-\*]\s+/, '').trim());
        }

        // Extract React components
        const componentMatches = content.match(/<([A-Z][A-Za-z]+)\s*\/?>|([A-Z][A-Za-z]+)\s+component/g);
        if (componentMatches) {
            spec.components = [...new Set(componentMatches.map(c => 
                c.replace(/[<>\/]/g, '').replace(/\s+component/i, '').trim()
            ))];
        }

        // Extract requirements (lines with MUST, SHOULD, SHALL)
        const requirementMatches = content.match(/.*\b(MUST|SHOULD|SHALL|REQUIRED)\b.*/gi);
        if (requirementMatches) {
            spec.requirements = requirementMatches;
        }

        return spec;
    }

    async analyzeActualCode() {
        this.log('🔍 Analyzing actual implementation...');
        this.actualImplementation = {
            endpoints: [],
            components: [],
            files: []
        };

        try {
            // Find all API endpoints
            const apiPath = path.join(REPO_DIR, 'pages/api');
            if (fs.existsSync(apiPath)) {
                this.actualImplementation.endpoints = this.scanForEndpoints(apiPath);
                this.log(`  📊 Found ${this.actualImplementation.endpoints.length} API endpoints`);
            }

            // Find all React components
            const componentsPath = path.join(REPO_DIR, 'components');
            if (fs.existsSync(componentsPath)) {
                this.actualImplementation.components = this.scanForComponents(componentsPath);
            }

            const pagesPath = path.join(REPO_DIR, 'pages');
            if (fs.existsSync(pagesPath)) {
                const pageComponents = this.scanForComponents(pagesPath);
                this.actualImplementation.components = [
                    ...this.actualImplementation.components,
                    ...pageComponents
                ];
            }
            this.log(`  📊 Found ${this.actualImplementation.components.length} React components`);

        } catch (error) {
            this.log(`  ❌ Analysis error: ${error.message}`);
        }
    }

    scanForEndpoints(dir, prefix = '/api') {
        const endpoints = [];
        
        const scan = (currentDir, currentPrefix) => {
            if (!fs.existsSync(currentDir)) return;
            
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scan(fullPath, `${currentPrefix}/${item}`);
                } else if (item.endsWith('.js') || item.endsWith('.ts')) {
                    const endpoint = `${currentPrefix}/${item.replace(/\.(js|ts)$/, '')}`;
                    endpoints.push(endpoint.replace('/index', ''));
                }
            }
        };
        
        scan(dir, prefix);
        return endpoints;
    }

    scanForComponents(dir) {
        const components = [];
        
        const scan = (currentDir) => {
            if (!fs.existsSync(currentDir)) return;
            
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'api') {
                    scan(fullPath);
                } else if (item.endsWith('.jsx') || item.endsWith('.tsx')) {
                    const componentName = item.replace(/\.(jsx|tsx)$/, '');
                    if (componentName[0] === componentName[0].toUpperCase()) {
                        components.push(componentName);
                    }
                }
            }
        };
        
        scan(dir);
        return components;
    }

    identifyGaps() {
        this.log('🎯 Identifying gaps between future and current...');
        this.gaps = [];

        // Compare future specs with current + actual
        for (const docFile in this.futureSpecs) {
            const future = this.futureSpecs[docFile];
            const current = this.currentSpecs[docFile] || { endpoints: [], features: [], components: [] };
            
            // Check missing endpoints
            for (const endpoint of future.endpoints || []) {
                const endpointPath = endpoint.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
                const implemented = this.actualImplementation.endpoints.some(e => 
                    e.includes(endpointPath.replace('/api', ''))
                );
                
                if (!implemented) {
                    this.gaps.push({
                        type: 'missing_endpoint',
                        method: endpoint.split(' ')[0],
                        path: endpointPath,
                        description: `Implement ${endpoint} endpoint`,
                        source: `docs-future/${docFile}`,
                        priority: 1
                    });
                }
            }

            // Check missing components
            for (const component of future.components || []) {
                const implemented = this.actualImplementation.components.includes(component);
                
                if (!implemented) {
                    this.gaps.push({
                        type: 'missing_component',
                        name: component,
                        description: `Create ${component} React component`,
                        source: `docs-future/${docFile}`,
                        priority: 2
                    });
                }
            }

            // Check missing features (more complex, needs semantic analysis)
            for (const feature of future.features || []) {
                // For now, create task for features not mentioned in current docs
                const inCurrent = current.features?.some(f => 
                    f.toLowerCase().includes(feature.toLowerCase().substring(0, 20))
                );
                
                if (!inCurrent && feature.length > 10) {
                    this.gaps.push({
                        type: 'missing_feature',
                        description: feature,
                        source: `docs-future/${docFile}`,
                        priority: 3
                    });
                }
            }
        }

        // Sort by priority
        this.gaps.sort((a, b) => a.priority - b.priority);
        this.log(`  🔍 Found ${this.gaps.length} gaps`);
        
        // Log first 5 gaps
        this.gaps.slice(0, 5).forEach(gap => {
            this.log(`    - ${gap.type}: ${gap.description}`);
        });
    }

    async createTaskInSystem(gap) {
        this.log(`📝 Creating task for: ${gap.description}`);
        
        try {
            // Create task via API
            const response = await fetch(`${API_BASE_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: gap.description,
                    description: `Auto-identified gap from ${gap.source}\n\nType: ${gap.type}\nPriority: ${gap.priority}`,
                    source: 'auto-improve',
                    priority: gap.priority,
                    metadata: {
                        gapType: gap.type,
                        sourceDoc: gap.source,
                        method: gap.method,
                        path: gap.path,
                        component: gap.name
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const task = await response.json();
            this.log(`  ✅ Created Task-${task.id}`);
            
            // Now create checkpoints for this task
            await this.createCheckpointsForTask(task, gap);
            
            return task;
            
        } catch (error) {
            this.log(`  ❌ Failed to create task: ${error.message}`);
            return null;
        }
    }

    async createCheckpointsForTask(task, gap) {
        this.log(`  🎯 Creating checkpoints for Task-${task.id}`);
        
        let checkpoints = [];
        
        if (gap.type === 'missing_endpoint') {
            checkpoints = [
                {
                    name: 'Create API file',
                    description: `Create ${gap.path}.js file`,
                    passCriteria: `File exists at pages${gap.path}.js`
                },
                {
                    name: 'Implement handler',
                    description: `Implement ${gap.method} handler with proper validation`,
                    passCriteria: 'Handler accepts requests and returns valid responses'
                },
                {
                    name: 'Add error handling',
                    description: 'Add proper error handling and status codes',
                    passCriteria: 'Returns appropriate error codes for invalid requests'
                }
            ];
        } else if (gap.type === 'missing_component') {
            checkpoints = [
                {
                    name: 'Create component file',
                    description: `Create ${gap.name}.jsx component`,
                    passCriteria: `File exists at components/${gap.name}.jsx`
                },
                {
                    name: 'Implement component logic',
                    description: 'Implement component with props and state',
                    passCriteria: 'Component renders without errors'
                },
                {
                    name: 'Add styling',
                    description: 'Add CSS/styled-components',
                    passCriteria: 'Component is properly styled'
                }
            ];
        } else {
            // Generic feature checkpoints
            checkpoints = [
                {
                    name: 'Implement feature',
                    description: gap.description,
                    passCriteria: 'Feature works as described'
                }
            ];
        }

        // Create checkpoints via API
        for (const checkpoint of checkpoints) {
            try {
                await fetch(`${API_BASE_URL}/api/checkpoint`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        taskId: task.id,
                        checkpoint: checkpoint
                    })
                });
                this.log(`    ✅ Created checkpoint: ${checkpoint.name}`);
            } catch (error) {
                this.log(`    ❌ Failed to create checkpoint: ${error.message}`);
            }
        }
    }

    async executeTasksWithClaude() {
        this.log('🤖 Triggering Claude execution of tasks...');
        
        // Call the Claude executor service on Fly.io
        try {
            const response = await fetch('https://uncle-frank-claude.fly.dev/api/tasks/execute-next', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: 'auto-improve'
                })
            });

            if (response.ok) {
                this.log('  ✅ Claude execution triggered');
            } else {
                this.log('  ⚠️  Claude executor not responding');
            }
        } catch (error) {
            this.log(`  ❌ Failed to trigger Claude: ${error.message}`);
        }
    }

    async runIteration() {
        this.iteration++;
        this.log(`\n========== ITERATION ${this.iteration} ==========`);
        this.log(`🧠 UNCLE FRANK AUTO-IMPROVE - TASK CREATOR MODE`);
        
        try {
            // Step 1: Sync repository
            await this.cloneOrUpdateRepo();
            
            // Step 2: Read future specifications
            await this.readDocsFuture();
            
            // Step 3: Read current documentation
            await this.readDocsCurrent();
            
            // Step 4: Analyze actual codebase
            await this.analyzeActualCode();
            
            // Step 5: Identify gaps
            this.identifyGaps();
            
            // Step 6: Create tasks for top gaps
            const gapsToProcess = Math.min(5, this.gaps.length);
            this.log(`📝 Creating tasks for top ${gapsToProcess} gaps...`);
            
            for (let i = 0; i < gapsToProcess; i++) {
                const task = await this.createTaskInSystem(this.gaps[i]);
                if (task) {
                    this.tasksCreated.push(task);
                }
            }
            
            // Step 7: Trigger Claude execution
            if (this.tasksCreated.length > 0) {
                await this.executeTasksWithClaude();
            }
            
            this.log(`📊 Iteration ${this.iteration} complete`);
            this.log(`  - Gaps found: ${this.gaps.length}`);
            this.log(`  - Tasks created: ${this.tasksCreated.length}`);
            
        } catch (error) {
            this.log(`❌ Iteration error: ${error.message}`);
        }
    }

    async run() {
        this.log('🚀 UNCLE FRANK AUTO-IMPROVE SYSTEM STARTING');
        this.log('📋 Mode: Create tasks in Uncle Frank system');
        this.log('🔄 Will continuously analyze gaps and create tasks');
        
        // Main loop
        while (true) {
            await this.runIteration();
            
            // Reset for next iteration
            this.tasksCreated = [];
            
            // Wait 5 minutes between iterations
            this.log('⏸️  Waiting 5 minutes before next iteration...');
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}

// Start the system
const improver = new UncleFrankAutoImprove();
improver.run().catch(console.error);