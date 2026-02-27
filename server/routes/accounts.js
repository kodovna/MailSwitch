import { Router } from 'express';
import { accountQueries, folderQueries, errorQueries, jobQueries } from '../db/database.js';
import { migrationEngine } from '../services/migration-engine.js';

const router = Router();

// List accounts for a job
router.get('/', (req, res) => {
  const { job_id } = req.query;
  if (!job_id) return res.status(400).json({ error: 'job_id is required' });

  const accounts = accountQueries.getByJobId(Number(job_id));
  // Strip passwords from response
  const safe = accounts.map(({ src_password, dst_password, ...rest }) => rest);
  res.json(safe);
});

// Get account detail with folder breakdown
router.get('/:id', (req, res) => {
  const account = accountQueries.getById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const folders = folderQueries.getByAccountId(account.id);
  const job = jobQueries.getById(account.job_id);
  const { src_password, dst_password, ...safe } = account;
  res.json({
    ...safe,
    src_host: job?.src_host,
    src_port: job?.src_port,
    dst_host: job?.dst_host,
    dst_port: job?.dst_port,
    folders,
  });
});

// Get errors for an account
router.get('/:id/errors', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const account = accountQueries.getById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const errors = errorQueries.getByAccountId(account.id, Number(limit), Number(offset));
  const total = errorQueries.countByAccountId(account.id);
  res.json({ errors, total });
});

// Retry a single failed account
router.post('/:id/retry', (req, res) => {
  try {
    migrationEngine.retrySingleAccount(Number(req.params.id));
    res.json({ status: 'retrying' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
