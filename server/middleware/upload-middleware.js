import multer from 'multer';
import { mkdirSync } from 'fs';
import { config } from '../config.js';

mkdirSync(config.uploadDir, { recursive: true });

export const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});
