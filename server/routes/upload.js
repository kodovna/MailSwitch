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

  const preview = accounts.map((a) => ({
    src_email: a.src_email,
    dst_email: a.dst_email,
  }));

  res.json({ accounts, preview, count: accounts.length });
});

export default router;
