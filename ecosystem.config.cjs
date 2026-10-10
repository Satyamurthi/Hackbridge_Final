const path = require('path');

module.exports = {
  apps: [
    {
      name: 'hackbridge-backend',
      script: './backend/dist/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      env_file: './backend/.env',
      error_file: path.join(__dirname, 'logs/hackbridge-error.log'),
      out_file: path.join(__dirname, 'logs/hackbridge-out.log'),
      log_file: path.join(__dirname, 'logs/hackbridge-combined.log'),
      time: true
    }
  ]
};

