# Using Anthropic API Instead of Claude Code CLI

Since Claude Code CLI requires interactive browser authentication (which doesn't work over SSH), we should use the Anthropic API directly.

## Current Situation

- Claude Code CLI is installed but can't authenticate over SSH
- The server already supports Anthropic API as a fallback
- We just need to set an API key

## Solution: Use Anthropic API

1. **Get an API key from Anthropic Console:**
   - Go to https://console.anthropic.com/settings/keys
   - Create a new API key
   - Copy it

2. **Set the API key on Fly.io:**
   ```bash
   fly secrets set ANTHROPIC_API_KEY="sk-ant-api03-..." -a uncle-frank-claude
   ```

3. **Wait for restart (30 seconds)**

4. **Test it works:**
   ```bash
   node test-claude-integration.js
   ```

## Why This Works Better

- No interactive authentication needed
- Works reliably on servers
- Same functionality as Claude Code CLI
- Already implemented in your server.js

## Note

The Claude Code CLI is meant for local development where you can open a browser. For server deployments, the API is the recommended approach.