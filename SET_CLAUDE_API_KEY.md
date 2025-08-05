# Setting Claude Executor API Key

The Claude Executor is deployed but needs an API key to work. Follow these steps:

## Option 1: Using Fly CLI (Recommended)

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
```

2. Login to Fly:
```bash
fly auth login
```

3. Set the API key:
```bash
fly secrets set ANTHROPIC_API_KEY="your-api-key-here" -a uncle-frank-claude
```

## Option 2: Using the update script

```bash
cd /Users/don/UncleFrank/unclefrank-bootstrap/claude-fly-deployment
./update-api-key.sh "your-api-key-here"
```

## Verifying it works

After setting the API key, test the integration:

```bash
# Test Claude Executor directly
curl https://uncle-frank-claude.fly.dev/health

# Test the full integration
node test-claude-integration.js
```

## Important Notes

1. The app will automatically restart when you set the secret
2. It may take 30-60 seconds for the restart to complete
3. The API key is stored securely and never exposed in logs
4. You can verify the key is set with: `fly secrets list -a uncle-frank-claude`