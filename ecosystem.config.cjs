// PM2 ecosystem config — run without Docker
// Usage:
//   npm run build
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup
//
// Env vars são carregadas do arquivo .env pelo dotenv (src/server.ts).
// O PM2 define apenas NODE_ENV e PORT — tudo mais vem do .env.

'use strict';

module.exports = {
  apps: [
    {
      name: 'tinpavi-backend',
      script: 'dist/server.js',

      // Cluster mode — one process per CPU core
      instances: 'max',
      exec_mode: 'cluster',

      // Restart thresholds
      max_memory_restart: '512M',
      kill_timeout: 30000,       // matches BACKEND_STOP_GRACE_PERIOD=30s
      listen_timeout: 10000,
      wait_ready: true,

      // Logging
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ── Production ──────────────────────────────────────────────────────────
      // Apenas NODE_ENV e PORT — todas as outras vars vêm do .env
      env_production: {
        NODE_ENV: 'production',
        // PORT vem do .env
      },

      // ── Development ─────────────────────────────────────────────────────────
      env_development: {
        NODE_ENV: 'development',
        // PORT vem do .env
      },
    },
  ],
};
