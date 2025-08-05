# Setting Up Claude Code on Fly.io

To enable real Claude execution (not simulation mode), you need to install and authenticate Claude Code on the Fly.io server.

## Quick Setup

1. **Connect to your Fly.io server:**
```bash
fly ssh console -a uncle-frank-claude
```

2. **Once connected, run these commands:**
```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify it's installed
claude --version

# Authenticate with your Anthropic account
claude login

# Follow the authentication prompts (it will give you a URL to visit)
# After authenticating, test it works:
claude chat
# Type "hello" and see if Claude responds
# Press Ctrl+C to exit the chat

# Exit the SSH session
exit
```

3. **Restart the app to pick up Claude Code:**
```bash
fly apps restart uncle-frank-claude
```

4. **Test the integration:**
```bash
node test-claude-integration.js
```

## What This Does

- Installs the official Claude Code CLI on your Fly.io server
- Authenticates it with your Anthropic account
- Enables the server to execute real Claude commands instead of simulation mode
- No API key needed - it uses your authenticated Claude session

## Troubleshooting

If Claude Code doesn't work after installation:
1. Make sure you completed the authentication (visited the URL it provided)
2. Check that the CLI works: `fly ssh console -a uncle-frank-claude` then `claude --version`
3. Restart the app: `fly apps restart uncle-frank-claude`

## Alternative: Use API Key

If you prefer to use an API key instead of Claude Code authentication:
```bash
fly secrets set ANTHROPIC_API_KEY="your-api-key" -a uncle-frank-claude
```

This will use the Anthropic SDK instead of Claude Code CLI.