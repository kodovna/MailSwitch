function parseDate(str) {
  if (!str) return null;
  // JS ISO strings already have 'T' and 'Z', SQLite datetime('now') gives '2024-01-01 00:00:00'
  if (str.includes('T')) return new Date(str);
  return new Date(str.replace(' ', 'T') + 'Z');
}

export function formatDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '-';
  return d.toLocaleString();
}

export function formatDuration(start, end) {
  const s = parseDate(start);
  if (!s) return '-';
  const e = end ? parseDate(end) : new Date();
  const diff = Math.floor((e - s) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export function percent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}
