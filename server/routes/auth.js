import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getDb } from '../db/database.js';
import { timingSafeEqual } from 'crypto';

const router = Router();

function safeCompare(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getDbPasswordHash() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get();
  return row?.value || null;
}

function isAuthRequired() {
  if (config.adminPassword) return true;
  return !!getDbPasswordHash();
}

router.post('/login', (req, res) => {
  const { password } = req.body;

  // No auth configured at all
  if (!config.adminPassword && !getDbPasswordHash()) {
    return res.json({ token: 'no-auth', requiresAuth: false });
  }

  if (!password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Priority 1: env var password
  if (config.adminPassword) {
    if (!safeCompare(password, config.adminPassword)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
  } else {
    // Priority 2: DB-stored bcrypt hash
    const hash = getDbPasswordHash();
    if (!hash || !bcrypt.compareSync(password, hash)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
  }

  const token = jwt.sign({ role: 'admin' }, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });

  res.json({ token });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/status', (req, res) => {
  const requiresAuth = isAuthRequired();

  if (!requiresAuth) {
    return res.json({ authenticated: true, requiresAuth: false });
  }

  // Check cookie or header
  const token = req.cookies?.token || req.headers.authorization?.slice(7);
  if (token) {
    try {
      jwt.verify(token, config.jwtSecret);
      return res.json({ authenticated: true, requiresAuth: true });
    } catch {
      // token expired/invalid
    }
  }

  return res.json({ authenticated: false, requiresAuth: true });
});

export default router;
