#!/usr/bin/env node

/**
 * AUTONOMOUS IMPROVEMENT SYSTEM
 * Runs endless cycle of red team analysis and development fixes
 * Uses proper agent spawning for more sophisticated analysis
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AutonomousImprovement {
    constructor() {
        this.iteration = 0;
        this.logFile = 'autonomous-improvement.log';
        this.running = true;
        this.currentIssues = [];
        this.fixedIssues = [];
        
        // Configuration
        this.autoPush = true; // Set to false to only commit locally
        this.pushEvery = 1; // Push every N iterations (1 = every time)
        this.maxIterations = null; // Set a number to limit iterations (null = endless)
    }

    async log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage);
        await fs.appendFile(this.logFile, logMessage);
    }

    async runRedTeamAnalysis() {
        await this.log(`🔴 RED TEAM ANALYSIS - Iteration ${this.iteration}`);
        
        const redTeamPrompt = `
As Uncle Frank's red team, brutally analyze the gaps between:
1. Current system at /Users/don/UncleFrank/unclefrank-bootstrap
2. Target specs in /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/

Key docs to check:
- /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/claude.md: Immutable flow (Draft → Validation → Task → Checkpoint → Review → Merge)
- /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/task.md: Task breakdown structure  
- /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/project.md: Target project state
- /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/interface.md: UI specifications
- /Users/don/UncleFrank/unclefrank-bootstrap/docs to work towards/technical.md: System architecture

Compare these against:
- Current /Users/don/UncleFrank/unclefrank-bootstrap/Project.md
- Current /Users/don/UncleFrank/unclefrank-bootstrap/CLAUDE.md
- Actual implementation files in /src, /pages/api, /public

Find the TOP 5 CRITICAL GAPS:
1. What core functionality is completely missing?
2. What's implemented but broken?
3. What violates the immutable flow?
4. What security/architecture flaws exist?
5. What would make Frank angry about this half-assed implementation?

Be specific. Give file paths and exact problems.
Rate each issue: CRITICAL | HIGH | MEDIUM

Output as JSON:
{
  "issues": [
    {
      "severity": "CRITICAL",
      "title": "Issue name",
      "description": "What's wrong",
      "location": "file/path",
      "fix": "Specific fix needed"
    }
  ]
}
`;

        try {
            // Run red team analysis via Claude
            const output = await this.runClaudeCommand(redTeamPrompt);
            
            // Parse the JSON response
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                this.currentIssues = analysis.issues || [];
                
                await this.log(`Found ${this.currentIssues.length} issues`);
                this.currentIssues.forEach((issue, i) => {
                    console.log(`${i+1}. [${issue.severity}] ${issue.title}`);
                });
                
                return this.currentIssues;
            }
        } catch (error) {
            await this.log(`Red team analysis error: ${error.message}`);
        }
        
        return [];
    }

    async runDeveloperFix() {
        if (this.currentIssues.length === 0) {
            await this.log("No issues to fix");
            return;
        }

        // Pick the most critical issue
        const criticalIssues = this.currentIssues.filter(i => i.severity === 'CRITICAL');
        const issue = criticalIssues[0] || this.currentIssues[0];
        
        await this.log(`🔨 FIXING: ${issue.title}`);
        
        const devPrompt = `
As Uncle Frank's top developer, fix this critical issue:

ISSUE: ${issue.title}
DESCRIPTION: ${issue.description}
LOCATION: ${issue.location}
SUGGESTED FIX: ${issue.fix}

Requirements:
1. Write the ACTUAL code to fix this
2. Create or modify the necessary files
3. Ensure it follows the immutable flow from Claude.md
4. Make it production-ready, no shortcuts
5. Test the fix if possible

Output your actions as:
ACTION: [what you did]
FILES: [files modified]
CODE: [actual code changes]
VERIFIED: [how you know it works]
`;

        try {
            const output = await this.runClaudeCommand(devPrompt);
            
            await this.log(`Developer fix completed for: ${issue.title}`);
            
            // Mark as fixed
            this.fixedIssues.push(issue);
            this.currentIssues = this.currentIssues.filter(i => i !== issue);
            
            // Check for actual file changes
            const hasChanges = await this.checkGitChanges();
            if (hasChanges) {
                await this.commitChanges(issue);
            }
            
        } catch (error) {
            await this.log(`Developer fix error: ${error.message}`);
        }
    }

    async runClaudeCommand(prompt) {
        return new Promise((resolve, reject) => {
            const claude = spawn('claude', ['chat'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            let error = '';
            
            claude.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            claude.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            claude.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Claude exited with code ${code}: ${error}`));
                } else {
                    resolve(output);
                }
            });
            
            // Send prompt
            claude.stdin.write(prompt);
            claude.stdin.end();
        });
    }

    async checkGitChanges() {
        return new Promise((resolve) => {
            const git = spawn('git', ['diff', '--quiet']);
            git.on('close', (code) => {
                resolve(code !== 0); // non-zero means there are changes
            });
        });
    }

    async commitChanges(issue) {
        const message = `Auto-fix: ${issue.title}

Severity: ${issue.severity}
Description: ${issue.description}
Location: ${issue.location}

Automated by Autonomous Improvement System - Iteration ${this.iteration}`;

        await this.runCommand('git', ['add', '-A']);
        await this.runCommand('git', ['commit', '-m', message]);
        await this.log(`Committed fix for: ${issue.title}`);
        
        // Push to GitHub if configured
        if (this.autoPush && (this.iteration % this.pushEvery === 0)) {
            try {
                await this.runCommand('git', ['push', 'origin', 'master']);
                await this.log(`✅ Pushed to GitHub: ${issue.title}`);
                await this.log(`🌐 Vercel will auto-deploy in ~2 minutes`);
            } catch (error) {
                await this.log(`⚠️ Failed to push to GitHub: ${error.message}`);
                await this.log(`Changes committed locally but not pushed`);
            }
        } else {
            await this.log(`📝 Committed locally (push disabled or waiting)`);
        }
    }

    async runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args);
            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`${command} failed with code ${code}`));
                } else {
                    resolve();
                }
            });
        });
    }

    async sleep(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async runLoop() {
        await this.log("🚀 STARTING AUTONOMOUS IMPROVEMENT SYSTEM");
        await this.log("Press Ctrl+C to stop");
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            await this.log("Shutting down gracefully...");
            this.running = false;
            process.exit(0);
        });
        
        while (this.running) {
            this.iteration++;
            
            // Check iteration limit
            if (this.maxIterations && this.iteration > this.maxIterations) {
                await this.log(`Reached max iterations (${this.maxIterations}). Stopping.`);
                break;
            }
            
            await this.log(`\n========== ITERATION ${this.iteration} ==========`);
            
            // Step 1: Red Team Analysis
            const issues = await this.runRedTeamAnalysis();
            
            if (issues.length === 0) {
                await this.log("No issues found! System might be perfect (unlikely) or red team failed");
                await this.sleep(60);
                continue;
            }
            
            // Step 2: Fix top issue
            await this.runDeveloperFix();
            
            // Step 3: Quick validation
            await this.log("📊 Progress Report:");
            await this.log(`  Iteration: ${this.iteration}`);
            await this.log(`  Fixed: ${this.fixedIssues.length} issues`);
            await this.log(`  Remaining: ${this.currentIssues.length} issues`);
            await this.log(`  Auto-push: ${this.autoPush ? 'Enabled' : 'Disabled'}`);
            
            // Step 4: Pause before next iteration
            const pauseTime = 30;
            await this.log(`⏸️  Pausing ${pauseTime} seconds before next iteration...`);
            await this.sleep(pauseTime);
        }
    }
}

// Start the autonomous system
const system = new AutonomousImprovement();
system.runLoop().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});