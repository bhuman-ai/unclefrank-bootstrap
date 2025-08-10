#!/bin/bash
# TMUX INJECTOR - Processes command queue and injects into Claude

QUEUE_DIR="/app/command-queue"
CLAUDE_SESSION="claude-manual"
PROCESSED_DIR="/app/command-queue/processed"

# Create directories if they don't exist
mkdir -p "$QUEUE_DIR"
mkdir -p "$PROCESSED_DIR"

echo "[TMUX-INJECTOR] Starting command queue processor..."
echo "[TMUX-INJECTOR] Using C-c to cancel, C-u to clear, C-m for Enter"

# Function to check if Claude is ready
check_claude_ready() {
    # Capture current pane content
    local pane_content=$(/usr/bin/tmux capture-pane -t "$CLAUDE_SESSION" -p | tail -5)
    
    # Check if Claude prompt is visible (ends with > or similar)
    if echo "$pane_content" | grep -q ">" || echo "$pane_content" | grep -q "Human:"; then
        return 0
    else
        return 1
    fi
}

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
        
        # First, cancel any existing prompt with C-c
        /usr/bin/tmux send-keys -t "$CLAUDE_SESSION" C-c
        sleep 0.3
        
        # Clear input with C-u
        /usr/bin/tmux send-keys -t "$CLAUDE_SESSION" C-u
        sleep 0.2
        
        # Send the command in chunks to handle long commands
        # tmux send-keys has a buffer limit, so we need to chunk it
        echo "[TMUX-INJECTOR] Command length: ${#COMMAND} characters"
        
        # Method 1: Try to paste from buffer (works for long text)
        echo "$COMMAND" | /usr/bin/tmux load-buffer -
        /usr/bin/tmux paste-buffer -t "$CLAUDE_SESSION"
        sleep 0.5
        
        # Press Enter with C-m (this is the correct way)
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