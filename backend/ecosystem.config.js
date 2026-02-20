module.exports = {
  apps: [
    {
      name: 'holdem-server',
      cwd: '/home/william/personal/texas-holdem/backend',
      script: 'bin/server.ts',
      exec_mode: 'fork',
      interpreter: 'bun',
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'staging',
      },
    },
  ],
}
