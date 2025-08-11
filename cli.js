#!/usr/bin/env node
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
}