#!/usr/bin/env node

/**
 * The simplest loop that actually works.
 * No bullshit. No complexity. Just progress.
 */

const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

// Get API key
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
    console.error("❌ Set ANTHROPIC_API_KEY environment variable");
    process.exit(1);
}

const client = new Anthropic.Anthropic({ apiKey });

// Create initial files if they don't exist
if (!fs.existsSync('target.md')) {
    fs.writeFileSync('target.md', `# Target: Simple Task Tracker

Create a working task tracker with:
1. Add tasks via command line
2. Mark tasks complete
3. Show task list
4. Save to tasks.json file

Make it work. Make it simple. Make it real.
`);
}

if (!fs.existsSync('current.md')) {
    fs.writeFileSync('current.md', `# Current State

Nothing built yet.
`);
}

// THE LOOP
let iteration = 0;

async function runLoop() {
    while (true) {
        iteration++;
        console.log(`\n${'='.repeat(50)}`);
        console.log(`ITERATION ${iteration}`);
        console.log('='.repeat(50));
        
        // Read current state
        const target = fs.readFileSync('target.md', 'utf8');
        const current = fs.readFileSync('current.md', 'utf8');
        
        // Find ONE thing to do
        console.log("\n🤔 Finding next step...");
        const response = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [{
                role: "user",
                content: `Target state:
${target}

Current state:
${current}

What is ONE SPECIFIC small thing to build next? 
Be concrete. Give me actual code or content to add.
Just tell me WHAT to build, not how.
Keep it SIMPLE.`
            }]
        });
        
        const nextStep = response.content[0].text;
        console.log(`\n📋 Next step: ${nextStep.substring(0, 200)}...`);
        
        // Build it
        console.log("\n🔨 Building...");
        const buildResponse = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4000,
            messages: [{
                role: "user",
                content: `Current state:
${current}

Build this: ${nextStep}

Give me the EXACT code or content to add/create.
If it's code, give me the complete file.
Start your response with either:
FILE: filename.js
or
UPDATE_CURRENT:

Then the actual content.`
            }]
        });
        
        const buildOutput = buildResponse.content[0].text;
        
        // Save it
        if (buildOutput.startsWith('FILE:')) {
            const lines = buildOutput.split('\n');
            const filename = lines[0].replace('FILE:', '').trim();
            const content = lines.slice(1).join('\n');
            
            console.log(`\n💾 Creating ${filename}`);
            fs.writeFileSync(filename, content);
            
            // Update current.md
            const currentContent = fs.readFileSync('current.md', 'utf8');
            fs.writeFileSync('current.md', 
                currentContent + `\n\n## Iteration ${iteration}\nCreated: ${filename}\n`
            );
        } else if (buildOutput.startsWith('UPDATE_CURRENT:')) {
            const content = buildOutput.replace('UPDATE_CURRENT:', '').trim();
            console.log(`\n📝 Updating current state`);
            fs.writeFileSync('current.md', content);
        }
        
        console.log("\n✅ Done with this iteration");
        console.log("\nPress Ctrl+C to stop, or wait 5 seconds for next iteration...");
        
        // Wait 5 seconds or until interrupted
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log("\n\n👋 Stopping loop. Check your files!");
    process.exit(0);
});

// Run it
console.log("🚀 Starting simple loop...");
runLoop().catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
});