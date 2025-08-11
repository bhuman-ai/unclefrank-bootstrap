#!/bin/bash
echo "=== CLAUDE TMUX DEBUG ==="
echo "1. Checking tmux sessions:"
tmux list-sessions

echo -e "\n2. Capturing Claude pane content:"
tmux capture-pane -t claude-manual -p > /tmp/claude-pane.txt
echo "Last 50 lines of Claude pane:"
tail -50 /tmp/claude-pane.txt

echo -e "\n3. Checking if Claude process is running:"
ps -ef | grep -i claude | grep -v grep

echo -e "\n4. Checking command queue:"
ls -la /app/command-queue/

echo -e "\n5. Testing direct command injection:"
echo "Sending test command..."
tmux send-keys -t claude-manual C-c
sleep 0.5
tmux send-keys -t claude-manual "echo 'DEBUG TEST' > /tmp/debug-test.txt"
sleep 0.5
tmux send-keys -t claude-manual C-m
sleep 3

echo -e "\n6. Checking if test file was created:"
if [ -f "/tmp/debug-test.txt" ]; then
    echo "✅ SUCCESS! Claude executed command"
    cat /tmp/debug-test.txt
else
    echo "❌ FAILED! Claude did not execute command"
fi

echo -e "\n7. Final pane capture after test:"
tmux capture-pane -t claude-manual -p | tail -10