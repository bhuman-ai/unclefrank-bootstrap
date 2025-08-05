# Fixing Claude Code CLI Authentication on Fly.io

## The Problem
Claude Code CLI requires interactive browser authentication, which doesn't work in a headless container environment.

## Solution: Pre-authenticate and Copy Config

### Step 1: Authenticate Claude Code CLI Locally
```bash
# On your local machine
claude login
# Complete the browser authentication
```

### Step 2: Find Your Claude Config
```bash
# The auth token is stored in:
cat ~/.config/claude/config.json
```

### Step 3: Create a Secret in Fly.io
```bash
# Copy the entire config.json content and set it as a secret
fly secrets set CLAUDE_CONFIG='{"token":"your-token-here","...rest-of-config"}' -a uncle-frank-claude
```

### Step 4: Update the Dockerfile to Use Pre-auth
Create a new file called `setup-claude-auth.sh`:

```bash
#!/bin/bash
# This runs on container startup
if [ ! -z "$CLAUDE_CONFIG" ]; then
    mkdir -p ~/.config/claude
    echo "$CLAUDE_CONFIG" > ~/.config/claude/config.json
    echo "Claude Code CLI configured from secret"
fi
```

### Step 5: Update server.js to Check Auth
Before using Claude, verify it's authenticated:
```javascript
// Check Claude auth status
const { stdout: authCheck } = await execAsync('claude auth status').catch(() => ({ stdout: '' }));
if (!authCheck.includes('Authenticated')) {
    console.error('Claude Code CLI not authenticated!');
}
```

## Alternative: Use SSH Tunnel for One-Time Auth

### Step 1: SSH with Port Forward
```bash
# Forward local port to container
fly ssh console -a uncle-frank-claude -L 5173:localhost:5173
```

### Step 2: In Container, Run Auth
```bash
# Inside container
claude login
# It will give you a localhost URL - access it through your forwarded port
```

### Step 3: Verify Auth Persists
```bash
claude auth status
# Should show "Authenticated"
```

### Step 4: Restart the App
```bash
exit
fly apps restart uncle-frank-claude
```