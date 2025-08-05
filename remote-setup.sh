#!/bin/bash

# Create SSH command with password
# Note: You'll need to install sshpass first: brew install sshpass

echo "Setting up Claude-Code-Remote on Vultr VM..."
echo "==========================================="

# First, let's create the setup script locally and copy it
cat > /tmp/setup-claude-remote.sh << 'SCRIPT_END'
#!/bin/bash

# FRANK'S CLAUDE-CODE-REMOTE SETUP SCRIPT
echo "🔨 Uncle Frank's Claude-Code-Remote Setup"
echo "========================================="

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
apt install -y git curl wget build-essential python3 python3-pip nodejs npm unzip

# Install Node.js 20 (Claude-Code-Remote requires newer version)
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Clone Claude-Code-Remote
echo "📂 Cloning Claude-Code-Remote..."
cd /opt
if [ -d "Claude-Code-Remote" ]; then
    echo "Directory exists, pulling latest..."
    cd Claude-Code-Remote
    git pull
else
    git clone https://github.com/JessyTsui/Claude-Code-Remote.git
    cd Claude-Code-Remote
fi

# Check package.json structure
echo "📋 Checking project structure..."
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found!"
    echo "Let me check the repository structure..."
    ls -la
    
    # If it's a different structure, adapt
    if [ -d "webapp" ]; then
        echo "Found webapp directory..."
        cd webapp
    elif [ -d "server" ]; then
        echo "Found server directory..."
        cd server
    fi
fi

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install || {
    echo "❌ npm install failed, trying with legacy peer deps..."
    npm install --legacy-peer-deps
}

# Create .env file
echo "🔧 Creating configuration..."
cat > .env << 'EOF'
# Server Configuration
PORT=3000
HOST=0.0.0.0

# Workspace Configuration
WORKSPACE_DIR=/workspace
MAX_FILE_SIZE=10485760

# Session Management
SESSION_TIMEOUT=3600000
MAX_SESSIONS=10

# Security (we'll add the API key later)
ENABLE_AUTH=false
EOF

# Create workspace directory
mkdir -p /workspace

# Create a simple test server first
echo "🧪 Creating test server..."
cat > test-server.js << 'EOF'
const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Claude-Code-Remote test server running',
        time: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Test server listening at http://0.0.0.0:${port}`);
});
EOF

# Install express for test server
npm install express

# Create systemd service for test server
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/claude-test.service << 'EOF'
[Unit]
Description=Claude Code Remote Test Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/Claude-Code-Remote
ExecStart=/usr/bin/node test-server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/claude-test.log
StandardError=append:/var/log/claude-test.error.log

[Install]
WantedBy=multi-user.target
EOF

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 8080/tcp
echo "y" | ufw enable

# Start service
echo "🚀 Starting test service..."
systemctl daemon-reload
systemctl enable claude-test
systemctl start claude-test

# Check if main app exists
if [ -f "app.js" ] || [ -f "server.js" ] || [ -f "index.js" ]; then
    echo "📱 Found main application file"
    # Create proper service for actual app
    MAIN_FILE=$(ls app.js server.js index.js 2>/dev/null | head -1)
    
    cat > /etc/systemd/system/claude-code-remote.service << EOF
[Unit]
Description=Claude Code Remote Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/Claude-Code-Remote
ExecStart=/usr/bin/node $MAIN_FILE
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/claude-code-remote.log
StandardError=append:/var/log/claude-code-remote.error.log
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

    systemctl enable claude-code-remote
    systemctl start claude-code-remote
fi

# Show status
echo ""
echo "✅ Setup complete!"
echo ""
echo "Service status:"
systemctl status claude-test --no-pager
echo ""
echo "📍 Test server running at:"
echo "   http://207.148.12.169:3000"
echo ""
echo "📋 Logs available at:"
echo "   /var/log/claude-test.log"
echo "   /var/log/claude-test.error.log"
echo ""
echo "🔧 Next steps:"
echo "   1. Test connection: curl http://207.148.12.169:3000/api/health"
echo "   2. Check actual Claude-Code-Remote structure"
echo "   3. Update service to run the correct application"
echo ""
echo "📂 Installed in: /opt/Claude-Code-Remote"
SCRIPT_END

echo "Script created. Now connecting to VM..."
echo ""
echo "Please enter the SSH password when prompted:"
echo "Password is: %7Wdy)=J[r5Y$Zy8"
echo ""

# Copy and execute
scp /tmp/setup-claude-remote.sh root@207.148.12.169:/tmp/
ssh root@207.148.12.169 'chmod +x /tmp/setup-claude-remote.sh && /tmp/setup-claude-remote.sh'