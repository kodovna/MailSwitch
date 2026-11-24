import { logger } from './logger.js';

// Authentication failures never get better by waiting, so they are not retried
const isRetryable = (err) => !err.authenticationFailed;

export async function retry(fn, { maxRetries = 3, baseDelay = 2000, factor = 4, maxDelay = 60000, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryable(err)) {
        const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
        logger.warn(`${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, {
          error: err.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

export async function retryMessage(fn, { maxRetries = 2, delay = 1000, label = 'message' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        logger.debug(`${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
