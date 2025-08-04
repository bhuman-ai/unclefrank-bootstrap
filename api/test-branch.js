import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, branchName, testCriteria, threadId } = req.body;

  try {
    switch (action) {
      case 'detect-branch': {
        // FRANK'S BRANCH DETECTION - GET THE REAL BRANCH FROM TERRAGON'S WORK
        if (!threadId) {
          return res.status(400).json({ error: 'Thread ID required to detect branch' });
        }

        try {
          // Get current branch
          const { stdout: currentBranch } = await execAsync('git branch --show-current');
          
          // Fetch latest branches from remote
          await execAsync('git fetch origin');
          
          // Look for branches created by Terragon
          const { stdout: branches } = await execAsync('git branch -r | grep terragon');
          const branchList = branches.split('\n').filter(b => b.trim());
          
          // Find the most recent Terragon branch
          let latestBranch = null;
          let latestTime = 0;
          
          for (const branch of branchList) {
            const branchName = branch.trim().replace('origin/', '');
            try {
              const { stdout: commitTime } = await execAsync(
                `git log -1 --format=%ct origin/${branchName}`
              );
              const time = parseInt(commitTime.trim());
              if (time > latestTime) {
                latestTime = time;
                latestBranch = branchName;
              }
            } catch (e) {
              // Branch might not exist locally
            }
          }
          
          return res.status(200).json({
            currentBranch: currentBranch.trim(),
            terragonBranches: branchList.map(b => b.trim().replace('origin/', '')),
            latestTerragonBranch: latestBranch,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          console.error('Branch detection failed:', error);
          return res.status(500).json({
            error: 'Failed to detect branch',
            details: error.message
          });
        }
      }

      case 'test-on-branch': {
        // FRANK'S BRANCH TESTING - TEST THE ACTUAL BRANCH, NOT PRODUCTION
        if (!branchName) {
          return res.status(400).json({ error: 'Branch name required' });
        }

        try {
          // Store current branch
          const { stdout: currentBranch } = await execAsync('git branch --show-current');
          
          // Checkout the target branch
          console.log(`Checking out branch: ${branchName}`);
          await execAsync(`git checkout ${branchName}`);
          
          // Pull latest changes
          await execAsync('git pull origin ' + branchName);
          
          // Run the actual test
          let testResult = {
            branch: branchName,
            passed: false,
            details: '',
            error: null
          };
          
          if (testCriteria) {
            // Here we would run the actual test against the checked out code
            // For now, we'll check if files exist as specified in criteria
            try {
              const fs = require('fs');
              const path = require('path');
              
              // Simple file existence check for now
              if (testCriteria.includes('file exists') || testCriteria.includes('created')) {
                // Extract file path from criteria
                const fileMatch = testCriteria.match(/['"](.*?)['"]/);
                if (fileMatch) {
                  const filePath = fileMatch[1];
                  const fullPath = path.join(process.cwd(), filePath);
                  testResult.passed = fs.existsSync(fullPath);
                  testResult.details = testResult.passed 
                    ? `File ${filePath} exists on branch ${branchName}`
                    : `File ${filePath} not found on branch ${branchName}`;
                }
              }
            } catch (testError) {
              testResult.error = testError.message;
              testResult.details = `Test execution failed: ${testError.message}`;
            }
          }
          
          // Return to original branch
          await execAsync(`git checkout ${currentBranch.trim()}`);
          
          return res.status(200).json({
            ...testResult,
            originalBranch: currentBranch.trim(),
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          // Try to return to original branch on error
          try {
            const { stdout: current } = await execAsync('git branch --show-current');
            if (current.trim() !== currentBranch.trim()) {
              await execAsync(`git checkout ${currentBranch.trim()}`);
            }
          } catch (e) {
            console.error('Failed to return to original branch:', e);
          }
          
          return res.status(500).json({
            error: 'Branch test failed',
            details: error.message,
            branch: branchName
          });
        }
      }

      case 'test-via-api': {
        // FRANK'S API TESTING - TEST AGAINST DEPLOYED BRANCH
        if (!branchName) {
          return res.status(400).json({ error: 'Branch name required' });
        }

        // Try different URL patterns for Vercel
        const urlPatterns = [
          `https://unclefrank-bootstrap-git-${branchName.replace(/\//g, '-')}-bhuman-ai.vercel.app`,
          `https://unclefrank-bootstrap-git-${branchName.replace(/\//g, '-')}-bhuman.vercel.app`,
          `https://unclefrank-bootstrap-${branchName.replace(/\//g, '-')}.vercel.app`
        ];

        for (const testUrl of urlPatterns) {
          try {
            const response = await fetch(`${testUrl}/api/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'start' })
            });

            if (response.ok) {
              // Found working deployment
              return res.status(200).json({
                branch: branchName,
                deploymentUrl: testUrl,
                apiEndpoint: `${testUrl}/api/execute`,
                status: 'ready',
                message: `Branch deployment found at ${testUrl}`,
                timestamp: new Date().toISOString()
              });
            }
          } catch (e) {
            // Try next pattern
          }
        }

        // No deployment found
        return res.status(404).json({
          branch: branchName,
          error: 'No deployment found for branch',
          triedPatterns: urlPatterns,
          suggestion: 'Use test-on-branch action to test locally'
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Test Branch API Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}