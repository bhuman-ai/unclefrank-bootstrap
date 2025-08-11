#!/usr/bin/env node

/**
 * DEMO of the simple loop - shows what it would do
 */

const fs = require('fs');

// Create initial files
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

// Simulate the loop
console.log("🚀 DEMO MODE - Showing what the loop would do...\n");

const steps = [
    {
        step: "Create a basic task.js file with add/list functions",
        file: "task.js",
        content: `// Simple task tracker
const fs = require('fs');

const tasksFile = 'tasks.json';

function loadTasks() {
    if (!fs.existsSync(tasksFile)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
}

function saveTasks(tasks) {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
}

function addTask(description) {
    const tasks = loadTasks();
    tasks.push({ id: Date.now(), description, done: false });
    saveTasks(tasks);
    console.log('✅ Task added');
}

function listTasks() {
    const tasks = loadTasks();
    tasks.forEach(t => {
        console.log(\`[\${t.done ? 'X' : ' '}] \${t.id}: \${t.description}\`);
    });
}

module.exports = { addTask, listTasks };`
    },
    {
        step: "Create CLI interface",
        file: "cli.js",
        content: `#!/usr/bin/env node
const { addTask, listTasks } = require('./task');

const command = process.argv[2];
const args = process.argv.slice(3);

switch(command) {
    case 'add':
        addTask(args.join(' '));
        break;
    case 'list':
        listTasks();
        break;
    default:
        console.log('Usage: node cli.js [add|list] ...');
}`
    }
];

// Simulate iterations
for (let i = 0; i < steps.length; i++) {
    console.log(`${'='.repeat(50)}`);
    console.log(`ITERATION ${i + 1}`);
    console.log('='.repeat(50));
    
    console.log(`\n📋 Next step: ${steps[i].step}`);
    console.log(`\n💾 Creating ${steps[i].file}`);
    
    // Actually create the files
    fs.writeFileSync(steps[i].file, steps[i].content);
    
    // Update current.md
    const current = fs.readFileSync('current.md', 'utf8');
    fs.writeFileSync('current.md', 
        current + `\n\n## Iteration ${i + 1}\nCreated: ${steps[i].file} - ${steps[i].step}\n`
    );
    
    console.log("✅ Done\n");
}

console.log("\n🎯 DEMO COMPLETE! Now you have:");
console.log("- task.js: Core task management");
console.log("- cli.js: Command line interface");
console.log("\nTry it:");
console.log("  node cli.js add Buy milk");
console.log("  node cli.js list");