#!/bin/bash
# Check what's in the Claude tmux pane

echo "Capturing Claude tmux pane content..."
tmux capture-pane -t claude-manual -p > /tmp/claude-pane.txt
echo "Content saved to /tmp/claude-pane.txt"
echo "Last 30 lines:"
tail -30 /tmp/claude-pane.txt