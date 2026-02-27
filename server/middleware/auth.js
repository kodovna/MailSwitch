import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db/database.js';

function isAuthRequired() {
  if (config.adminPassword) return true;
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get();
  return !!row?.value;
}

export function requireAuth(req, res, next) {
  // Skip auth if no password is configured (neither env var nor DB)
  if (!isAuthRequired()) {
    return next();
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      jwt.verify(token, config.jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Check cookie
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try {
      jwt.verify(cookieToken, config.jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

// SSE auth — check token from query param (EventSource can't set headers)
export function requireAuthSSE(req, res, next) {
  if (!isAuthRequired()) {
    return next();
  }

  const token = req.query.token;
  if (token) {
    try {
      jwt.verify(token, config.jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Fallback to cookie
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try {
      jwt.verify(cookieToken, config.jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}
