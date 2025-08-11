// Simple task tracker
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
        console.log(`[${t.done ? 'X' : ' '}] ${t.id}: ${t.description}`);
    });
}

module.exports = { addTask, listTasks };