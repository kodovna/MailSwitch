import { readFileSync, statSync } from 'fs';
import Papa from 'papaparse';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let cache = { path: null, mtimeMs: 0, entries: new Map() };

// CSV columns: email, username, password, usage (kilobytes, optional). A header row is skipped (first cell has no "@").
function load() {
  const path = config.mailboxCsvPath;
  if (!path) return new Map();

  try {
    const { mtimeMs } = statSync(path);
    if (cache.path === path && cache.mtimeMs === mtimeMs) return cache.entries;

    const { data } = Papa.parse(readFileSync(path, 'utf-8'), { skipEmptyLines: true });
    const entries = new Map();
    for (const row of data) {
      const email = String(row[0] || '').trim().toLowerCase();
      if (!email.includes('@')) continue;
      entries.set(email, {
        username: String(row[1] || '').trim(),
        password: String(row[2] || ''),
        usage: Number.isFinite(Number(row[3])) && String(row[3] || '').trim() !== '' ? Number(row[3]) : null,
      });
    }
    cache = { path, mtimeMs, entries };
    return entries;
  } catch (err) {
    logger.warn('Could not read mailbox CSV', { path, error: err.message });
    return new Map();
  }
}

export function listMailboxes() {
  return [...load()]
    .map(([email, { username, usage }]) => ({ email, username, usage }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

// Builds a prefilled account: source logs in as the CSV username with the CSV password,
// destination is the address itself. The destination password is not known in advance
// (the mailbox may not exist yet), so it is left for the user to fill in.
export function buildAccount(email) {
  const key = String(email || '').trim().toLowerCase();
  const entry = load().get(key);
  if (!entry) return null;
  return {
    src_email: entry.username,
    src_password: entry.password,
    dst_email: key,
    dst_password: '',
  };
}

// Prefilled accounts for every mailbox of a domain
export function buildDomainAccounts(domain) {
  const suffix = `@${String(domain || '').trim().toLowerCase()}`;
  if (suffix === '@') return [];
  return [...load().keys()].filter((email) => email.endsWith(suffix)).sort().map(buildAccount);
}
