#!/bin/bash
# TMUX INJECTOR - Processes command queue and injects into Claude

QUEUE_DIR="/app/command-queue"
CLAUDE_SESSION="claude-manual"
PROCESSED_DIR="/app/command-queue/processed"

# Create directories if they don't exist
mkdir -p "$QUEUE_DIR"
mkdir -p "$PROCESSED_DIR"

echo "[TMUX-INJECTOR] Starting command queue processor..."

while true; do
    # Check for command files in queue
    for cmd_file in "$QUEUE_DIR"/*.cmd; do
        # Skip if no files
        [ ! -f "$cmd_file" ] && continue
        
        # Get the command
        COMMAND=$(cat "$cmd_file")
        SESSION_ID=$(basename "$cmd_file" .cmd)
        
        echo "[TMUX-INJECTOR] Processing command for session $SESSION_ID"
        echo "[TMUX-INJECTOR] Command: $COMMAND"
        
        # Clear input
        /usr/bin/tmux send-keys -t "$CLAUDE_SESSION" C-u
        sleep 0.2
        
        # Send the command in chunks to handle long commands
        # tmux send-keys has a buffer limit, so we need to chunk it
        echo "[TMUX-INJECTOR] Command length: ${#COMMAND} characters"
        
        # Method 1: Try to paste from buffer (works for long text)
        echo "$COMMAND" | /usr/bin/tmux load-buffer -
        /usr/bin/tmux paste-buffer -t "$CLAUDE_SESSION"
        sleep 0.5
        
        # Press Enter
        /usr/bin/tmux send-keys -t "$CLAUDE_SESSION" C-m
        
        echo "[TMUX-INJECTOR] Command injected successfully"
        
        # Move to processed
        mv "$cmd_file" "$PROCESSED_DIR/"
        
        # Wait a bit before processing next command
        sleep 1
    done
    
    # Sleep before checking again
    sleep 1
done