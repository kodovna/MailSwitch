import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { existsSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase, getDb } from './db/database.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireAuth, requireAuthSSE } from './middleware/auth.js';
import { migrationEngine } from './services/migration-engine.js';
import { eventBus } from './services/event-bus.js';
import { logger } from './utils/logger.js';
import authRouter from './routes/auth.js';
import setupRouter from './routes/setup.js';
import uploadRouter from './routes/upload.js';
import jobsRouter from './routes/jobs.js';
import accountsRouter from './routes/accounts.js';
import eventsRouter from './routes/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists with restrictive permissions
const dataDir = dirname(config.dbPath);
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true, mode: 0o700 });

// Initialize database
initDatabase();

// Set restrictive permissions on DB file
try { chmodSync(config.dbPath, 0o600); } catch { /* may not exist yet */ }

// Startup warnings
if (!config.adminPassword) {
  // Check if DB-based password has been set via first-time setup
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'setup_completed'").get();
  if (!row?.value) {
    logger.warn('No admin password configured — first-time setup will be required via the web UI.');
  }
}
if (!config.encryptionKey) {
  logger.warn('ENCRYPTION_KEY not set — passwords stored unencrypted. Set ENCRYPTION_KEY env var for production use.');
}

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS — restrict to same origin
app.use(cors({ origin: true, credentials: true }));

// Cookie parser for JWT auth
app.use(cookieParser());

// Body parser with reduced limit
app.use(express.json({ limit: '5mb' }));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Strict rate limiter for auth-testing endpoints
const authTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many authentication attempts, try again in a minute' },
});

// Public routes (no auth required)
app.use('/api/auth', authRouter);
app.use('/api/setup', authTestLimiter, setupRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// test-auth and test-connection are behind requireAuth already, no rate limiter needed

// Protected API routes
app.use('/api/upload', requireAuth, uploadRouter);
app.use('/api/jobs', requireAuth, jobsRouter);
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/events', requireAuthSSE, eventsRouter);

// Serve static frontend files
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — only for non-API routes
  app.get(/^(?!\/api\/).*/, (_req, res) => {
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
  eventBus.shutdown();
  migrationEngine.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
