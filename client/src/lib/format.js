export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr + 'Z').toLocaleString();
}

export function formatDuration(start, end) {
  if (!start) return '-';
  const s = new Date(start + 'Z');
  const e = end ? new Date(end + 'Z') : new Date();
  const diff = Math.floor((e - s) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export function percent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}
