module.exports = {
  apps: [
    {
      name: 'plataforma-dev',
      // On Windows, pm2 cannot execute .cmd shell wrappers.
      // Use the real Node.js entry point from next's dist folder.
      script: 'node_modules/next/dist/bin/next',
      args: 'dev',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 15,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
      },
    },
  ],
}
