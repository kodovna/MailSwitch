import { Router } from 'express';
import { listMailboxes, buildAccount } from '../services/mailbox-list.js';

const router = Router();

// Source addresses for the autocomplete (no credentials)
router.get('/', (_req, res) => {
  res.json({ mailboxes: listMailboxes() });
});

// Prefilled account for one address
router.get('/account', (req, res) => {
  const account = buildAccount(req.query.email);
  if (!account) return res.status(404).json({ error: 'Mailbox not found' });
  res.json(account);
});

export default router;
