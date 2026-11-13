import { createApp } from './server';
import { config } from './config/env';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[SECURE VAULT] Server running in ${config.nodeEnv} mode on http://localhost:${config.port}`);
  console.log(`[SECURE VAULT] Object Storage Driver: ${config.storageDriver.toUpperCase()}`);
  console.log(`[SECURE VAULT] AES-256-GCM envelope encryption initialized.`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[SECURE VAULT] Initiating graceful shutdown...');
  server.close(() => {
    console.log('[SECURE VAULT] Server connections closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
