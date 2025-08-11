#!/bin/bash

# Just do ONE FUCKING STEP to prove it works

echo "🎯 ONE STEP DEMO - BUILD SOMETHING NOW"

# Create the HTML directly with Claude
claude --print "Create a simple HTML file called tasks.html that:
1. Has a task list
2. Has an input field to add tasks
3. Has buttons to mark tasks complete
4. Stores tasks in localStorage
5. Works standalone - no server needed

Give me the COMPLETE HTML file. Start with <!DOCTYPE html> and make it fully functional." > tasks.html

echo "✅ Created tasks.html"
echo "📂 Opening in browser..."
open tasks.html

echo ""
echo "THAT'S IT. One command, one working file."
echo "Now imagine this in a loop, building piece by piece."