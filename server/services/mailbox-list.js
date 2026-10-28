import { readFileSync, statSync } from 'fs';
import Papa from 'papaparse';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let cache = { path: null, mtimeMs: 0, entries: new Map() };

// CSV columns: email, username, password. A header row is skipped (first cell has no "@").
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
        username: String(row[1] || '').trim() || email,
        password: String(row[2] || ''),
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
  return [...load().keys()].sort();
}

// Builds a prefilled account: source is the "-migrate" duplicate with the shared password,
// destination uses the plain address with the credentials from the CSV.
export function buildAccount(email) {
  const entry = load().get(String(email || '').trim().toLowerCase());
  if (!entry) return null;
  const key = String(email).trim().toLowerCase();
  return {
    src_email: `${key}${config.migrateSuffix}`,
    src_password: config.migratePassword,
    dst_email: entry.username,
    dst_password: entry.password,
  };
}
