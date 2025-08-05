#!/bin/bash

# FRANK'S CLAUDE-CODE-REMOTE SETUP SCRIPT
# Run this on your Vultr VM as root

echo "🔨 Uncle Frank's Claude-Code-Remote Setup"
echo "========================================="

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
apt install -y git curl wget build-essential python3 python3-pip nodejs npm

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Clone Claude-Code-Remote
echo "📂 Cloning Claude-Code-Remote..."
cd /opt
git clone https://github.com/JessyTsui/Claude-Code-Remote.git
cd Claude-Code-Remote

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create systemd service
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/claude-code-remote.service << 'EOF'
[Unit]
Description=Claude Code Remote Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/Claude-Code-Remote
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/claude-code-remote.log
StandardError=append:/var/log/claude-code-remote.error.log

[Install]
WantedBy=multi-user.target
EOF

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 8080/tcp
ufw --force enable

# Start service
echo "🚀 Starting Claude-Code-Remote service..."
systemctl daemon-reload
systemctl enable claude-code-remote
systemctl start claude-code-remote

# Show status
echo ""
echo "✅ Setup complete!"
echo ""
echo "Service status:"
systemctl status claude-code-remote --no-pager
echo ""
echo "📍 Access Claude-Code-Remote at:"
echo "   http://207.148.12.169:3000"
echo ""
echo "📋 Logs available at:"
echo "   /var/log/claude-code-remote.log"
echo "   /var/log/claude-code-remote.error.log"
echo ""
echo "🔧 Useful commands:"
echo "   systemctl status claude-code-remote"
echo "   systemctl restart claude-code-remote"
echo "   journalctl -u claude-code-remote -f"
echo "   tail -f /var/log/claude-code-remote.log"