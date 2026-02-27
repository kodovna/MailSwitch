import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase } from './db/database.js';
import { errorHandler } from './middleware/error-handler.js';
import { migrationEngine } from './services/migration-engine.js';
import { logger } from './utils/logger.js';
import uploadRouter from './routes/upload.js';
import jobsRouter from './routes/jobs.js';
import accountsRouter from './routes/accounts.js';
import eventsRouter from './routes/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = dirname(config.dbPath);
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Initialize database
initDatabase();

const app = express();

app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/upload', uploadRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/events', eventsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend files
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`MailSwitch server running on port ${config.port}`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  migrationEngine.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
