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
  if (!row.src_host || !HOST_RE.test(row.src_host)) {
    errors.push(`Row ${rowNum}: Invalid source host "${row.src_host || ''}"`);
  }
  if (row.src_port && (isNaN(row.src_port) || row.src_port < 1 || row.src_port > 65535)) {
    errors.push(`Row ${rowNum}: Invalid source port "${row.src_port}"`);
  }
  if (!row.dst_email || !EMAIL_RE.test(row.dst_email)) {
    errors.push(`Row ${rowNum}: Invalid destination email "${row.dst_email || ''}"`);
  }
  if (!row.dst_password) {
    errors.push(`Row ${rowNum}: Missing destination password`);
  }
  if (!row.dst_host || !HOST_RE.test(row.dst_host)) {
    errors.push(`Row ${rowNum}: Invalid destination host "${row.dst_host || ''}"`);
  }
  if (row.dst_port && (isNaN(row.dst_port) || row.dst_port < 1 || row.dst_port > 65535)) {
    errors.push(`Row ${rowNum}: Invalid destination port "${row.dst_port}"`);
  }

  return errors;
}

export function sanitizeRow(row) {
  return {
    src_email: String(row.src_email || '').trim().toLowerCase(),
    src_password: String(row.src_password || ''),
    src_host: String(row.src_host || '').trim().toLowerCase(),
    src_port: parseInt(row.src_port, 10) || 993,
    dst_email: String(row.dst_email || '').trim().toLowerCase(),
    dst_password: String(row.dst_password || ''),
    dst_host: String(row.dst_host || '').trim().toLowerCase(),
    dst_port: parseInt(row.dst_port, 10) || 993,
  };
}
