import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}
