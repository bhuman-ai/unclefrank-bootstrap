#!/bin/bash

# FRANK'S SERVERLESS CLAUDE DEPLOYMENT

echo "🚀 Deploying Enhanced Claudebox Serverless"
echo "========================================"

# Option 1: Google Cloud Run (truly serverless)
deploy_cloud_run() {
    echo "📦 Building for Cloud Run..."
    
    # Build container
    gcloud builds submit --tag gcr.io/YOUR-PROJECT/claude-executor
    
    # Deploy to Cloud Run
    gcloud run deploy claude-executor \
        --image gcr.io/YOUR-PROJECT/claude-executor \
        --platform managed \
        --region us-central1 \
        --allow-unauthenticated \
        --memory 2Gi \
        --timeout 300 \
        --set-env-vars="ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
    
    # Get URL
    SERVICE_URL=$(gcloud run services describe claude-executor --platform managed --region us-central1 --format 'value(status.url)')
    echo "✅ Deployed to: $SERVICE_URL"
}

# Option 2: Fly.io (almost serverless, scales to zero)
deploy_fly_io() {
    echo "📦 Deploying to Fly.io..."
    
    # Create fly.toml
    cat > fly.toml << 'EOF'
app = "claude-executor"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile.claudebox-enhanced"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  max_machines_running = 3

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[machine]
  memory = "2gb"
  cpus = 2
EOF

    # Launch
    fly launch --now
    
    # Set secrets
    fly secrets set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
    
    # Get URL
    fly status
}

# Option 3: Railway (super easy, scales to zero)
deploy_railway() {
    echo "📦 Deploying to Railway..."
    
    # Create railway.json
    cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.claudebox-enhanced"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

    # Deploy
    railway up
    railway domain
}

# Option 4: AWS Lambda (true serverless with Serverless Framework)
deploy_lambda() {
    echo "📦 Deploying to AWS Lambda..."
    
    # Create serverless.yml
    cat > serverless.yml << 'EOF'
service: claude-executor

provider:
  name: aws
  runtime: nodejs20.x
  stage: prod
  region: us-east-1
  timeout: 300
  memorySize: 2048
  environment:
    ANTHROPIC_API_KEY: ${env:ANTHROPIC_API_KEY}

functions:
  api:
    handler: lambda.handler
    events:
      - httpApi: '*'

plugins:
  - serverless-offline
  - serverless-plugin-typescript
EOF

    # Deploy
    serverless deploy
}

# Choose deployment
echo ""
echo "Choose deployment option:"
echo "1) Google Cloud Run (recommended)"
echo "2) Fly.io (easiest)"
echo "3) Railway (simplest)"
echo "4) AWS Lambda (most scalable)"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1) deploy_cloud_run ;;
    2) deploy_fly_io ;;
    3) deploy_railway ;;
    4) deploy_lambda ;;
    *) echo "Invalid choice" ;;
esac