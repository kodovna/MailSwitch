export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || '/data/mailswitch.db',
  uploadDir: process.env.UPLOAD_DIR || '/data/uploads',
  maxConcurrentAccounts: parseInt(process.env.MAX_CONCURRENT || '5', 10),
  syncInterval: parseInt(process.env.SYNC_INTERVAL || '300', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  messageRetries: parseInt(process.env.MESSAGE_RETRIES || '2', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
};
