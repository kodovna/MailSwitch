import { readFileSync, unlinkSync } from 'fs';
import Papa from 'papaparse';
import { validateCsvRow, sanitizeRow } from '../utils/validators.js';

const REQUIRED_HEADERS = ['src_email', 'src_password', 'src_host', 'dst_email', 'dst_password', 'dst_host'];
const MAX_ACCOUNTS = 50;

export function parseCsvFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Clean up uploaded file
  try { unlinkSync(filePath); } catch { /* ignore */ }

  const { data, errors: parseErrors } = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parseErrors.length > 0) {
    const messages = parseErrors.map((e) => `Row ${e.row + 1}: ${e.message}`);
    return { accounts: [], errors: messages };
  }

  if (data.length === 0) {
    return { accounts: [], errors: ['CSV file is empty or has no data rows'] };
  }

  // Check required headers
  const headers = Object.keys(data[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return { accounts: [], errors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  }

  if (data.length > MAX_ACCOUNTS) {
    return { accounts: [], errors: [`Too many accounts (${data.length}). Maximum is ${MAX_ACCOUNTS}.`] };
  }

  const sanitized = data.map(sanitizeRow);
  const errors = sanitized.flatMap((row, i) => validateCsvRow(row, i));

  return { accounts: sanitized, errors };
}
