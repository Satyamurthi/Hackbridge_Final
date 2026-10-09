module.exports = {
  apps: [
    {
      name: 'hackbridge-backend',
      script: './backend/dist/server.js',
      cwd: '/home/ubuntu/hackbridge-main',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      env_file: './backend/.env',
      error_file: '/home/ubuntu/logs/hackbridge-error.log',
      out_file: '/home/ubuntu/logs/hackbridge-out.log',
      log_file: '/home/ubuntu/logs/hackbridge-combined.log',
      time: true
    }
  ]
};
