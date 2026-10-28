import { Router } from 'express';
import { listMailboxes, buildAccount, buildDomainAccounts } from '../services/mailbox-list.js';

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

// Prefilled accounts for every mailbox of a domain
router.get('/domain', (req, res) => {
  const accounts = buildDomainAccounts(req.query.domain);
  if (accounts.length === 0) return res.status(404).json({ error: 'Domain not found' });
  res.json({ accounts });
});

export default router;
