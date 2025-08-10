#!/usr/bin/env node

/**
 * AUTO-IMPROVE SYSTEM - Uses EXISTING Queue System
 * This properly integrates with your working Claude queue
 */

const https = require('https');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const API_BASE = 'https://uncle-frank-claude.fly.dev';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

class AutoImproveViaQueue {
    constructor() {
        this.iteration = 0;
        this.sessionId = null;
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
            name: `Auto-improve iteration ${this.iteration}`,
            workspace: '/tmp/unclefrank-bootstrap'
        });
        
        this.sessionId = response.sessionId;
        this.log(`✅ Session created: ${this.sessionId}`);
        return this.sessionId;
    }

    async executeImprovement() {
        this.log('🤖 Sending improvement task to Claude...');
        
        const tasks = [
            "Look for the 'docs to work towards' folder and compare it with current implementation in pages/api/. Find the #1 most critical missing feature and implement it.",
            "Check if /api/task/validate endpoint exists. If not, create it at pages/api/task/validate.js to validate tasks before execution per Uncle Frank's spec.",
            "Check if /api/project/draft endpoint exists. If not, create it at pages/api/project/draft.js to handle draft updates to Project.md.",
            "Review existing endpoints and add proper error handling and Uncle Frank personality to responses."
        ];
        
        // Pick a task for this iteration
        const task = tasks[this.iteration % tasks.length];
        
        await this.makeRequest(`/api/sessions/${this.sessionId}/execute`, 'POST', {
            message: task + " Make it production ready and actually work."
        });
        
        this.log(`📋 Task queued: ${task}`);
    }

    async waitForCompletion() {
        this.log('⏳ Waiting for Claude to complete task...');
        
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max (5 sec intervals)
        
        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
            
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
            if (attempts % 12 === 0) { // Every minute
                this.log(`Still processing... (${attempts * 5} seconds elapsed)`);
            }
        }
        
        this.log('⏰ Task timed out');
        return false;
    }

    async getSessionFiles() {
        this.log('📁 Checking files created by Claude...');
        
        const files = await this.makeRequest(`/api/sessions/${this.sessionId}/files`);
        this.log(`Files in session: ${JSON.stringify(files, null, 2)}`);
        return files;
    }

    async commitAndPush() {
        this.log('📝 Committing and pushing to GitHub...');
        
        try {
            // The session already has a workspace with the repo
            const sessionData = await this.makeRequest(`/api/sessions/${this.sessionId}`);
            const repoPath = sessionData.repoPath || `/workspace/${this.sessionId}/repo`;
            
            // Check for changes
            const { stdout: status } = await execAsync(`cd ${repoPath} && git status --porcelain`);
            
            if (!status.trim()) {
                this.log('📝 No changes to commit');
                return false;
            }
            
            this.log(`Changes detected:\n${status}`);
            
            // Commit locally
            await execAsync(`cd ${repoPath} && git add -A`);
            await execAsync(`cd ${repoPath} && git commit -m "Auto-improve: Iteration ${this.iteration}

Automated improvement via Claude queue system.
Session: ${this.sessionId}

Bot: Uncle Frank Auto-Improve"`);
            
            // Push to GitHub
            if (GITHUB_TOKEN) {
                await execAsync(`cd ${repoPath} && git push https://${GITHUB_TOKEN}@github.com/bhuman-ai/unclefrank-bootstrap.git master`);
                this.log('✅ Pushed to GitHub!');
                this.log('🌐 Vercel will deploy in ~2 minutes');
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
        this.log(`\n========== ITERATION ${this.iteration} ==========`);
        
        try {
            // Create session
            await this.createSession();
            
            // Execute improvement task
            await this.executeImprovement();
            
            // Wait for completion
            const completed = await this.waitForCompletion();
            
            if (completed) {
                // Check what was created
                await this.getSessionFiles();
                
                // Commit and push
                await this.commitAndPush();
            }
            
            this.log(`📊 Iteration ${this.iteration} complete`);
        } catch (error) {
            this.log(`❌ Iteration error: ${error.message}`);
        }
    }

    async run() {
        this.log('🚀 AUTO-IMPROVE VIA QUEUE STARTING');
        this.log('Uses your EXISTING working Claude queue system!');
        
        // Run continuously
        while (true) {
            await this.runIteration();
            
            // Wait 5 minutes between iterations
            this.log('⏸️ Waiting 5 minutes before next iteration...');
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
}

// Start the system
const improver = new AutoImproveViaQueue();
improver.run().catch(console.error);