# GitHub-Integrated Claude Executor for Fly.io
FROM node:20-slim

# Install required tools including git, tmux and GitHub CLI
RUN apt-get update && apt-get install -y \
    git \
    tmux \
    curl \
    build-essential \
    python3 \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install gh -y

WORKDIR /app

# Install Claude Code CLI globally and ensure it's in PATH
RUN npm install -g @anthropic-ai/claude-code && \
    echo "Claude Code installed at: $(which claude)" && \
    claude --version || echo "Claude version check failed"

# Note: claunch is for local development, not server deployment
# Using direct Claude CLI instead for server environment

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy server code - queue-based version with tmux injector
COPY server-queue.js ./
COPY tmux-injector.sh ./
COPY setup-claude-auth.sh ./
COPY tmux.conf /etc/tmux.conf

# Make scripts executable
RUN chmod +x setup-claude-auth.sh tmux-injector.sh

# Don't initialize config here - let startup.sh handle it with persistent storage

# Create workspace directory
RUN mkdir -p /workspace

# Set up git safe directory
RUN git config --global --add safe.directory '*'

# Fly.io uses PORT 8080
ENV PORT=8080
# Enable sandbox mode to allow --dangerously-skip-permissions as root
ENV IS_SANDBOX=1
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Copy startup script
COPY startup.sh ./
RUN chmod +x startup.sh

# Run startup script which handles persistent storage and starts server
CMD ["/bin/bash", "-c", "./startup.sh"]