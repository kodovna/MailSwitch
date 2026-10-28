import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function initDatabase() {
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  logger.info(`Database initialized at ${config.dbPath}`);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// Job helpers
export const jobQueries = {
  create(mode, totalAccounts, syncInterval = 300, { srcHost = '', srcPort = 993, srcSecurity = 'ssl', dstHost = '', dstPort = 993, dstSecurity = 'ssl' } = {}) {
    const stmt = getDb().prepare(
      `INSERT INTO migration_jobs (mode, total_accounts, sync_interval, src_host, src_port, src_security, dst_host, dst_port, dst_security) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    return stmt.run(mode, totalAccounts, syncInterval, srcHost, srcPort, srcSecurity, dstHost, dstPort, dstSecurity);
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM migration_jobs WHERE id = ?').get(id);
  },

  updateStatus(id, status) {
    const extras = {};
    if (status === 'running') extras.started_at = new Date().toISOString();
    if (['completed', 'cancelled', 'failed'].includes(status)) extras.finished_at = new Date().toISOString();

    const sets = ['status = ?', "updated_at = datetime('now')"];
    const params = [status];

    if (extras.started_at) { sets.push('started_at = ?'); params.push(extras.started_at); }
    if (extras.finished_at) { sets.push('finished_at = ?'); params.push(extras.finished_at); }

    params.push(id);
    getDb().prepare(`UPDATE migration_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  },

  updateCounts(id) {
    getDb().prepare(`
      UPDATE migration_jobs SET
        completed_accounts = (SELECT COUNT(*) FROM accounts WHERE job_id = ? AND status = 'completed'),
        failed_accounts = (SELECT COUNT(*) FROM accounts WHERE job_id = ? AND status = 'failed'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id, id, id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM migration_jobs WHERE id = ?').run(id);
  },

  getAll() {
    return getDb().prepare('SELECT * FROM migration_jobs ORDER BY created_at DESC').all();
  }
};

// Account helpers
export const accountQueries = {
  createMany(jobId, accounts) {
    const stmt = getDb().prepare(`
      INSERT INTO accounts (job_id, src_email, src_password, dst_email, dst_password)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertMany = getDb().transaction((rows) => {
      for (const row of rows) {
        stmt.run(jobId, row.src_email, encrypt(row.src_password), row.dst_email, encrypt(row.dst_password));
      }
    });
    insertMany(accounts);
  },

  getByJobId(jobId) {
    return getDb().prepare('SELECT * FROM accounts WHERE job_id = ? ORDER BY id').all(jobId);
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  },

  // Returns account with decrypted passwords — only for IMAP connections
  getByIdDecrypted(id) {
    const row = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!row) return row;
    return { ...row, src_password: decrypt(row.src_password), dst_password: decrypt(row.dst_password) };
  },

  getPendingByJobId(jobId) {
    return getDb().prepare(
      "SELECT * FROM accounts WHERE job_id = ? AND status IN ('pending', 'failed') ORDER BY id"
    ).all(jobId);
  },

  // Returns pending accounts with decrypted passwords — only for migration
  getPendingByJobIdDecrypted(jobId) {
    const rows = getDb().prepare(
      "SELECT * FROM accounts WHERE job_id = ? AND status IN ('pending', 'failed') ORDER BY id"
    ).all(jobId);
    return rows.map((r) => ({ ...r, src_password: decrypt(r.src_password), dst_password: decrypt(r.dst_password) }));
  },

  getRunningByJobId(jobId) {
    return getDb().prepare(
      "SELECT * FROM accounts WHERE job_id = ? AND status = 'running' ORDER BY id"
    ).all(jobId);
  },

  updateStatus(id, status, errorMessage = null) {
    const extras = {};
    if (status === 'running') extras.started_at = new Date().toISOString();
    if (['completed', 'failed', 'cancelled', 'skipped'].includes(status)) extras.finished_at = new Date().toISOString();

    const sets = ['status = ?', "updated_at = datetime('now')"];
    const params = [status];

    if (errorMessage !== null) { sets.push('error_message = ?'); params.push(errorMessage); }
    if (extras.started_at) { sets.push('started_at = ?'); params.push(extras.started_at); }
    if (extras.finished_at) { sets.push('finished_at = ?'); params.push(extras.finished_at); }

    params.push(id);
    getDb().prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  },

  updateProgress(id, { totalMessages, migratedMessages, failedMessages, skippedMessages, currentFolder }) {
    const sets = ["updated_at = datetime('now')"];
    const params = [];

    if (totalMessages !== undefined) { sets.push('total_messages = ?'); params.push(totalMessages); }
    if (migratedMessages !== undefined) { sets.push('migrated_messages = ?'); params.push(migratedMessages); }
    if (failedMessages !== undefined) { sets.push('failed_messages = ?'); params.push(failedMessages); }
    if (skippedMessages !== undefined) { sets.push('skipped_messages = ?'); params.push(skippedMessages); }
    if (currentFolder !== undefined) { sets.push('current_folder = ?'); params.push(currentFolder); }

    params.push(id);
    getDb().prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  },

  incrementMigrated(id) {
    getDb().prepare(
      "UPDATE accounts SET migrated_messages = migrated_messages + 1, updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  },

  incrementFailed(id) {
    getDb().prepare(
      "UPDATE accounts SET failed_messages = failed_messages + 1, updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  },

  getFailedCount(id) {
    const row = getDb().prepare('SELECT failed_messages FROM accounts WHERE id = ?').get(id);
    return row?.failed_messages || 0;
  },

  incrementSkipped(id) {
    getDb().prepare(
      "UPDATE accounts SET skipped_messages = skipped_messages + 1, updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  },

  resetFailed(jobId) {
    getDb().prepare(
      "UPDATE accounts SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE job_id = ? AND status = 'failed'"
    ).run(jobId);
  },

  resetSingleFailed(id) {
    getDb().prepare(
      "UPDATE accounts SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE id = ? AND status = 'failed'"
    ).run(id);
  },

  // Accounts left 'running'/'paused' with no live migrator (e.g. after a server restart)
  resetStale(jobId) {
    getDb().prepare(
      "UPDATE accounts SET status = 'pending', updated_at = datetime('now') WHERE job_id = ? AND status IN ('running', 'paused')"
    ).run(jobId);
  },

  resetCompleted(jobId) {
    getDb().prepare(
      "UPDATE accounts SET status = 'pending', error_message = NULL, updated_at = datetime('now') WHERE job_id = ? AND status = 'completed'"
    ).run(jobId);
  }
};

// Folder state helpers
export const folderQueries = {
  upsert(accountId, folderPath, { uidValidity, lastUid, totalMessages, migratedMessages, failedMessages, skippedMessages, status }) {
    getDb().prepare(`
      INSERT INTO folder_state (account_id, folder_path, uid_validity, last_uid, total_messages, migrated_messages, failed_messages, skipped_messages, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, folder_path) DO UPDATE SET
        uid_validity = excluded.uid_validity,
        last_uid = excluded.last_uid,
        total_messages = excluded.total_messages,
        migrated_messages = excluded.migrated_messages,
        failed_messages = excluded.failed_messages,
        skipped_messages = excluded.skipped_messages,
        status = excluded.status,
        updated_at = datetime('now')
    `).run(accountId, folderPath, uidValidity || null, lastUid || 0,
      totalMessages || 0, migratedMessages || 0, failedMessages || 0, skippedMessages || 0, status || 'pending');
  },

  getByAccountId(accountId) {
    return getDb().prepare('SELECT * FROM folder_state WHERE account_id = ? ORDER BY folder_path').all(accountId);
  },

  get(accountId, folderPath) {
    return getDb().prepare('SELECT * FROM folder_state WHERE account_id = ? AND folder_path = ?').get(accountId, folderPath);
  },

  updateLastUid(accountId, folderPath, lastUid) {
    getDb().prepare(
      "UPDATE folder_state SET last_uid = ?, updated_at = datetime('now') WHERE account_id = ? AND folder_path = ?"
    ).run(lastUid, accountId, folderPath);
  },

  incrementMigrated(accountId, folderPath) {
    getDb().prepare(
      "UPDATE folder_state SET migrated_messages = migrated_messages + 1, updated_at = datetime('now') WHERE account_id = ? AND folder_path = ?"
    ).run(accountId, folderPath);
  },

  incrementFailed(accountId, folderPath) {
    getDb().prepare(
      "UPDATE folder_state SET failed_messages = failed_messages + 1, updated_at = datetime('now') WHERE account_id = ? AND folder_path = ?"
    ).run(accountId, folderPath);
  },

  updateStatus(accountId, folderPath, status) {
    getDb().prepare(
      "UPDATE folder_state SET status = ?, updated_at = datetime('now') WHERE account_id = ? AND folder_path = ?"
    ).run(status, accountId, folderPath);
  }
};

// Error helpers
export const errorQueries = {
  create(accountId, { folderPath, messageUid, errorType, errorMessage, retryable = true }) {
    getDb().prepare(`
      INSERT INTO migration_errors (account_id, folder_path, message_uid, error_type, error_message, retryable)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(accountId, folderPath || null, messageUid || null, errorType, errorMessage, retryable ? 1 : 0);
  },

  getByAccountId(accountId, limit = 100, offset = 0) {
    return getDb().prepare(
      'SELECT * FROM migration_errors WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(accountId, limit, offset);
  },

  countByAccountId(accountId) {
    return getDb().prepare('SELECT COUNT(*) as count FROM migration_errors WHERE account_id = ?').get(accountId).count;
  },

  deleteByAccountId(accountId) {
    getDb().prepare('DELETE FROM migration_errors WHERE account_id = ?').run(accountId);
  }
};
