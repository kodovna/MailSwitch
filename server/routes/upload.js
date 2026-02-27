import { Router } from 'express';
import { upload } from '../middleware/upload-middleware.js';
import { parseCsvFile } from '../services/csv-parser.js';

const router = Router();

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { accounts, errors } = parseCsvFile(req.file.path);

  if (errors.length > 0) {
    return res.status(400).json({ errors, accounts: [] });
  }

  // Return sanitized accounts without passwords for preview
  const preview = accounts.map((a) => ({
    src_email: a.src_email,
    dst_email: a.dst_email,
  }));

  // Store full accounts in memory for job creation (keyed by request)
  // We send them back to the client which will POST them to /api/jobs
  res.json({ accounts, preview, count: accounts.length });
});

export default router;
