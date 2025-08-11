#!/bin/bash

# Check if API key file exists
if [ -f ~/.anthropic_key ]; then
    export ANTHROPIC_API_KEY=$(cat ~/.anthropic_key)
else
    echo "❌ Create ~/.anthropic_key file with your API key"
    echo "Run: echo 'your-api-key' > ~/.anthropic_key"
    exit 1
fi

echo "🚀 Starting simple loop with API key..."
node simple-loop.js