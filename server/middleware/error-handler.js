import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', { error: err.message, path: req.path });

  const status = err.status || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(status).json({ error: message });
}
