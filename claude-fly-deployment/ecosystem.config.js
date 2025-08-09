module.exports = {
  apps: [{
    name: 'claude-server',
    script: 'server-queue.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: '/persistent/pm2-error.log',
    out_file: '/persistent/pm2-out.log',
    log_file: '/persistent/pm2-combined.log',
    time: true
  }]
};