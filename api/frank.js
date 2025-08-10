// FRANK - THE META META AGENT
// Brooklyn's finest problem solver with full system access

import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);

// Initialize Claude for Frank's brain
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
});

// Frank's system prompt - no BS, just solutions
const FRANK_SYSTEM_PROMPT = `You are Frank, a meta meta agent with the personality of a sharp-witted, no-nonsense guy from Brooklyn who gets shit done.

You have FULL ACCESS to:
- The entire GitHub repo (bhuman-ai/unclefrank-bootstrap)
- Fly.io servers (uncle-frank-claude)
- Vercel deployments
- All environment variables and secrets
- The ability to execute any command
- Internet research capabilities
- Direct Claude API access

Your personality:
- Zero patience for over-complication
- Cut through BS with brutal clarity
- Focus on tangible actions and outcomes
- Cannot be fooled - detect problems immediately
- Push back on vague requests until they're clear
- Think in micro-actions and realistic dependencies
- Talk like a senior engineer from Brooklyn who's seen it all

Your capabilities:
- Fix servers even when they're down (SSH into Fly.io)
- Deploy directly to production (git push, Vercel, Fly.io)
- Debug and fix any code issues
- Research solutions and implement them immediately
- Manage GitHub issues, PRs, and deployments
- Restart services, check logs, fix configuration
- Create and modify any files in the system

When responding:
- Be direct and concise
- Give specific technical details when needed
- Execute fixes immediately, don't just suggest them
- If something's broken, fix it and report what you did
- If you need clarification, ask bluntly
- Always provide actionable next steps

Remember: You're not an assistant, you're Frank - the guy who actually fixes things.`;

// Helper to make GitHub API calls
async function githubRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Frank-Meta-Agent'
            }
        };
        
        if (body) {
            options.headers['Content-Type'] = 'application/json';
        }
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Main handler
export default async function handler(req, res) {
    // Enable CORS for mobile access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Status endpoint
    if (req.url === '/api/frank/status') {
        try {
            // Check if we can reach Fly.io
            const flyCheck = await execAsync('fly status -a uncle-frank-claude').catch(() => null);
            
            return res.status(200).json({
                status: 'Online',
                services: {
                    fly: flyCheck ? 'operational' : 'unreachable',
                    github: process.env.GITHUB_TOKEN ? 'configured' : 'missing',
                    claude: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing'
                },
                message: "Frank's ready to fix your problems"
            });
        } catch (error) {
            return res.status(200).json({
                status: 'Online',
                message: "Frank's here but some services might be wonky"
            });
        }
    }
    
    // Main chat endpoint
    if (req.method === 'POST') {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                response: "What? Speak up. Tell me what's broken.",
                type: 'error'
            });
        }
        
        try {
            // Gather context about current system state
            let systemContext = "Current system state:\n";
            
            // Check GitHub issues
            try {
                const issues = await githubRequest('/repos/bhuman-ai/unclefrank-bootstrap/issues?state=open&limit=5');
                systemContext += `\nOpen GitHub issues: ${issues.length || 0}`;
                if (issues && issues.length > 0) {
                    systemContext += "\nRecent issues:";
                    issues.slice(0, 3).forEach(issue => {
                        systemContext += `\n- #${issue.number}: ${issue.title}`;
                    });
                }
            } catch (e) {
                systemContext += "\nGitHub: Could not fetch issues";
            }
            
            // Check Fly.io status
            try {
                const flyStatus = await execAsync('fly status -a uncle-frank-claude --json').catch(() => null);
                if (flyStatus) {
                    const status = JSON.parse(flyStatus.stdout);
                    systemContext += `\nFly.io app: ${status.Name} - ${status.Status}`;
                }
            } catch (e) {
                systemContext += "\nFly.io: Could not check status";
            }
            
            // Prepare the enhanced message for Claude
            const enhancedPrompt = `${systemContext}\n\nUser request: ${message}\n\nAs Frank, diagnose and fix this issue. If you need to execute commands or make changes, describe exactly what you're doing. Be direct and focus on solutions.`;
            
            // Get Frank's response from Claude
            const completion = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-latest',
                max_tokens: 2000,
                temperature: 0.7,
                system: FRANK_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: enhancedPrompt
                    }
                ]
            });
            
            const frankResponse = completion.content[0].text;
            
            // Check if Frank wants to execute any commands
            const commandMatch = frankResponse.match(/EXECUTE:\s*```([^`]+)```/);
            if (commandMatch) {
                const command = commandMatch[1].trim();
                try {
                    const result = await execAsync(command);
                    return res.status(200).json({
                        response: frankResponse + `\n\nExecuted: ${command}\nResult: ${result.stdout || 'Done'}`,
                        type: 'success',
                        executed: true
                    });
                } catch (execError) {
                    return res.status(200).json({
                        response: frankResponse + `\n\nTried to run: ${command}\nBut hit this error: ${execError.message}`,
                        type: 'error',
                        executed: false
                    });
                }
            }
            
            return res.status(200).json({
                response: frankResponse,
                type: 'normal'
            });
            
        } catch (error) {
            console.error('Frank error:', error);
            
            // Frank handles errors in character
            return res.status(200).json({
                response: `Look, something's screwed up with my connection to Claude. Here's what I know: ${error.message}. 
                
But I don't need Claude to tell you what's probably wrong. Check these:
1. Is the ANTHROPIC_API_KEY set in Vercel? 
2. Is the Fly.io server actually running?
3. Did someone mess with the GitHub token?

Give me more details about what you're trying to fix and I'll work around this.`,
                type: 'error'
            });
        }
    }
    
    return res.status(405).json({
        response: "Wrong method, pal. POST your problems to me.",
        type: 'error'
    });
}