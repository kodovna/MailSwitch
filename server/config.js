import { randomBytes } from 'crypto';

// Auto-generate secrets if not provided (persisted in memory for the process lifetime)
const autoJwtSecret = randomBytes(32).toString('hex');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || '/data/mailswitch.db',
  uploadDir: process.env.UPLOAD_DIR || '/data/uploads',
  maxConcurrentAccounts: parseInt(process.env.MAX_CONCURRENT || '5', 10),
  syncInterval: parseInt(process.env.SYNC_INTERVAL || '60', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  messageRetries: parseInt(process.env.MESSAGE_RETRIES || '2', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Auth
  adminPassword: process.env.ADMIN_PASSWORD || '',
  jwtSecret: process.env.JWT_SECRET || autoJwtSecret,
  jwtExpiry: process.env.JWT_EXPIRY || '24h',

  // Encryption key for passwords at rest (32 bytes hex = 64 chars)
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // TLS
  allowSelfSignedCerts: process.env.ALLOW_SELF_SIGNED_CERTS === 'true',
};
