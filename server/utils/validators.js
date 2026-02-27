const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$/;

export function validateCsvRow(row, index) {
  const errors = [];
  const rowNum = index + 1;

  if (!row.src_email || !EMAIL_RE.test(row.src_email)) {
    errors.push(`Row ${rowNum}: Invalid source email "${row.src_email || ''}"`);
  }
  if (!row.src_password) {
    errors.push(`Row ${rowNum}: Missing source password`);
  }
  if (!row.dst_email || !EMAIL_RE.test(row.dst_email)) {
    errors.push(`Row ${rowNum}: Invalid destination email "${row.dst_email || ''}"`);
  }
  if (!row.dst_password) {
    errors.push(`Row ${rowNum}: Missing destination password`);
  }

  return errors;
}

export function sanitizeRow(row) {
  return {
    src_email: String(row.src_email || '').trim().toLowerCase(),
    src_password: String(row.src_password || ''),
    dst_email: String(row.dst_email || '').trim().toLowerCase(),
    dst_password: String(row.dst_password || ''),
  };
}

export function validateServerConfig({ host, port }) {
  const errors = [];
  if (!host || !HOST_RE.test(host)) {
    errors.push(`Invalid host "${host || ''}"`);
  }
  if (port !== undefined && port !== null) {
    const p = Number(port);
    if (isNaN(p) || p < 1 || p > 65535) {
      errors.push(`Invalid port "${port}"`);
    }
  }
  return errors;
}
