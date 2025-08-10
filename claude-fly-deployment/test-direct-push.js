#!/usr/bin/env node

/**
 * Test direct git push to trigger Vercel deployment
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

async function testPush() {
    console.log('🚀 Testing direct push to GitHub...');
    
    try {
        const repoPath = '/tmp/unclefrank-bootstrap';
        
        // Clone if needed
        if (!fs.existsSync(repoPath)) {
            console.log('Cloning repo...');
            await execAsync(`git clone https://github.com/bhuman-ai/unclefrank-bootstrap.git ${repoPath}`);
        }
        
        // Pull latest
        console.log('Pulling latest...');
        await execAsync(`cd ${repoPath} && git pull`);
        
        // Create a test file
        const testFile = path.join(repoPath, 'test-auto-improve.txt');
        const timestamp = new Date().toISOString();
        fs.writeFileSync(testFile, `Auto-improve test at ${timestamp}\n`);
        
        // Configure git
        await execAsync(`cd ${repoPath} && git config user.name "Uncle Frank Bot"`);
        await execAsync(`cd ${repoPath} && git config user.email "frank@unclefrank.ai"`);
        
        // Commit
        await execAsync(`cd ${repoPath} && git add -A`);
        await execAsync(`cd ${repoPath} && git commit -m "Test auto-improve push at ${timestamp}"`);
        
        // Push with token
        const token = process.env.GITHUB_TOKEN;
        if (token) {
            console.log('Pushing with token...');
            await execAsync(`cd ${repoPath} && git push https://${token}@github.com/bhuman-ai/unclefrank-bootstrap.git master`);
            console.log('✅ Successfully pushed! Check Vercel.');
        } else {
            console.log('❌ No GITHUB_TOKEN found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPush();