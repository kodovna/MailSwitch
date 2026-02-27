import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { config } from '../config.js';

const router = Router();

router.get('/status', (_req, res) => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'setup_completed'").get();
  const setupCompleted = row?.value === 'true';
  res.json({ setupCompleted });
});

router.post('/', (req, res) => {
  // Block if setup already completed
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'setup_completed'").get();
  if (row?.value === 'true') {
    return res.status(400).json({ error: 'Setup already completed' });
  }

  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = bcrypt.hashSync(password, 10);

  const upsert = getDb().prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  getDb().transaction(() => {
    upsert.run('admin_password_hash', hash);
    upsert.run('setup_completed', 'true');
  })();

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

export default router;
