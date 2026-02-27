import { Router } from 'express';
import { jobQueries, accountQueries } from '../db/database.js';
import { migrationEngine } from '../services/migration-engine.js';
import { ImapClient } from '../services/imap-client.js';
import { validateServerConfig } from '../utils/validators.js';

const router = Router();

// Test IMAP server connectivity
router.post('/test-connection', async (req, res) => {
  const { host, port = 993, security = 'ssl' } = req.body;

  const errors = validateServerConfig({ host, port });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors.join(', ') });
  }

  const result = await ImapClient.testConnection({ host, port: Number(port), security });
  res.json(result);
});

// Test IMAP authentication for a single account
router.post('/test-auth', async (req, res) => {
  const { host, port = 993, security = 'ssl', email, password } = req.body;

  if (!host || !email || !password) {
    return res.status(400).json({ success: false, error: 'host, email, and password are required' });
  }

  const result = await ImapClient.testAuth({ host, port: Number(port), security, email, password });
  res.json(result);
});

// Create a new migration job
router.post('/', (req, res) => {
  const { accounts, mode = 'full', syncInterval = 60, serverConfig = {} } = req.body;

  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ error: 'No accounts provided' });
  }

  if (accounts.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 accounts allowed' });
  }

  // Validate mode
  if (!['full', 'continuous'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  // Validate and clamp sync interval
  const clampedInterval = Math.max(60, Math.min(86400, Number(syncInterval) || 300));

  const { srcHost, srcPort = 993, srcSecurity = 'ssl', dstHost, dstPort = 993, dstSecurity = 'ssl' } = serverConfig;
  if (!srcHost || !dstHost) {
    return res.status(400).json({ error: 'Server config (srcHost, dstHost) is required' });
  }

  // Validate security values
  const validSecurity = ['ssl', 'starttls', 'none'];
  if (!validSecurity.includes(srcSecurity) || !validSecurity.includes(dstSecurity)) {
    return res.status(400).json({ error: 'Invalid security mode' });
  }

  const result = jobQueries.create(mode, accounts.length, clampedInterval, {
    srcHost, srcPort: Number(srcPort), srcSecurity, dstHost, dstPort: Number(dstPort), dstSecurity,
  });
  const jobId = result.lastInsertRowid;

  accountQueries.createMany(jobId, accounts);

  const job = jobQueries.getById(jobId);
  res.status(201).json(job);
});

// Get all jobs
router.get('/', (_req, res) => {
  const jobs = jobQueries.getAll();
  res.json(jobs);
});

// Get job by ID with accounts
router.get('/:id', (req, res) => {
  const job = jobQueries.getById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const accounts = accountQueries.getByJobId(job.id).map(
    ({ src_password, dst_password, ...rest }) => rest
  );
  res.json({ ...job, accounts, syncing: migrationEngine.isSyncing(job.id), nextSyncAt: migrationEngine.nextSyncAt.get(job.id) || null });
});

// Start or resume a job
router.post('/:id/start', async (req, res) => {
  try {
    const job = jobQueries.getById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (job.status === 'paused') {
      migrationEngine.resumeJob(job.id);
    } else {
      // Start in background, don't await
      migrationEngine.startJob(job.id).catch(() => {});
    }

    res.json({ status: 'started' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Pause a job
router.post('/:id/pause', (req, res) => {
  try {
    migrationEngine.pauseJob(Number(req.params.id));
    res.json({ status: 'paused' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel a job
router.post('/:id/cancel', (req, res) => {
  try {
    migrationEngine.cancelJob(Number(req.params.id));
    res.json({ status: 'cancelled' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Retry all failed accounts
router.post('/:id/retry-failed', (req, res) => {
  try {
    migrationEngine.retryFailedAccounts(Number(req.params.id));
    res.json({ status: 'retrying' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Resync — delta sync to catch up new emails
router.post('/:id/resync', (req, res) => {
  try {
    migrationEngine.resyncJob(Number(req.params.id));
    res.json({ status: 'resyncing' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle continuous sync
router.post('/:id/sync', (req, res) => {
  const jobId = Number(req.params.id);
  const job = jobQueries.getById(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (migrationEngine.isSyncing(jobId)) {
    migrationEngine.stopContinuousSync(jobId);
    res.json({ syncing: false });
  } else {
    migrationEngine.startContinuousSync(jobId);
    res.json({ syncing: true });
  }
});

export default router;
