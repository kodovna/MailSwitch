import { ImapClient } from './imap-client.js';
import { shouldFullSync, getLastUid, buildFetchRange } from './delta-sync.js';
import { accountQueries, folderQueries, errorQueries } from '../db/database.js';
import { eventBus } from './event-bus.js';
import { retry, retryMessage } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const FOLDER_RETRY_DELAY_MS = 2000;
const FETCH_BATCH_SIZE = 25;
// Give up on a folder after this many single messages make the source server drop the connection
const MAX_POISONED_PER_FOLDER = 5;

function isConnectionError(err) {
  const text = `${err.code || ''} ${err.message || ''}`;
  return /Connection not available|NoConnection|ECONNRESET|EPIPE|ETIMEDOUT|Connection closed|socket/i.test(text);
}

export class AccountMigrator {
  constructor(account, job) {
    this.account = account;
    this.job = job;
    this.jobId = job.id;
    this.cancelled = false;
    this.paused = false;
    this.srcClient = null;
    this.dstClient = null;
    this.migratedCount = account.migrated_messages || 0;
    this.failedFolders = [];
    this.poisonedInFolder = 0;
  }

  cancel() {
    this.cancelled = true;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  async waitIfPaused() {
    while (this.paused && !this.cancelled) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  connectSource() {
    const { account } = this;
    const { src_host, src_port, src_security } = this.job;
    return retry(
      () => {
        const client = new ImapClient({
          host: src_host,
          port: src_port,
          security: src_security || 'ssl',
          email: account.src_email,
          password: account.src_password,
          label: `src:${account.src_email}`,
        });
        return client.connect().then(() => client);
      },
      { maxRetries: 3, label: `Connect to source ${account.src_email}` }
    );
  }

  connectDestination() {
    const { account } = this;
    const { dst_host, dst_port, dst_security } = this.job;
    return retry(
      () => {
        const client = new ImapClient({
          host: dst_host,
          port: dst_port,
          security: dst_security || 'ssl',
          email: account.dst_email,
          password: account.dst_password,
          label: `dst:${account.dst_email}`,
        });
        return client.connect().then(() => client);
      },
      { maxRetries: 3, label: `Connect to destination ${account.dst_email}` }
    );
  }

  // Reopen whichever connection the server dropped while the account was migrating
  async ensureConnected() {
    if (!this.srcClient.usable) {
      logger.warn(`Reconnecting to source for ${this.account.src_email}`);
      await this.srcClient.disconnect();
      this.srcClient = await this.connectSource();
    }
    if (!this.dstClient.usable) {
      logger.warn(`Reconnecting to destination for ${this.account.dst_email}`);
      await this.dstClient.disconnect();
      this.dstClient = await this.connectDestination();
    }
  }

  async migrate() {
    const { account, jobId } = this;
    logger.info(`Starting migration for ${account.src_email}`, { accountId: account.id });

    accountQueries.updateStatus(account.id, 'running');
    eventBus.emitAccountUpdate(jobId, account.id, { status: 'running' });

    try {
      // Connect to both servers with retry (host/port/security from job-level config)
      this.srcClient = await this.connectSource();
      this.dstClient = await this.connectDestination();

      // List source folders
      const srcFolders = await this.srcClient.listFolders();
      logger.info(`Found ${srcFolders.length} folders for ${account.src_email}`);

      // Create missing folders on destination
      for (const folder of srcFolders) {
        if (this.cancelled) break;
        await this.dstClient.createFolder(folder.path);
      }

      // Count total messages
      let totalMessages = 0;
      for (const folder of srcFolders) {
        try {
          const status = await this.srcClient.getStatus(folder.path);
          totalMessages += status.messages || 0;
        } catch {
          // skip status errors
        }
      }
      accountQueries.updateProgress(account.id, { totalMessages });
      eventBus.emitAccountUpdate(jobId, account.id, { totalMessages });

      // Migrate each folder
      for (const folder of srcFolders) {
        if (this.cancelled) break;
        await this.waitIfPaused();
        await this.ensureConnected();
        await this.migrateFolder(folder.path);
      }

      if (this.cancelled) {
        accountQueries.updateStatus(account.id, 'cancelled');
        eventBus.emitAccountUpdate(jobId, account.id, { status: 'cancelled' });
      } else {
        const failedMessages = accountQueries.getFailedCount(account.id);
        if (this.failedFolders.length > 0) {
          // Folders that could not be copied: leave the account failed so it shows up and can be retried
          const message = `${this.failedFolders.length} folder(s) failed: ${this.failedFolders.join(', ')}`;
          accountQueries.updateStatus(account.id, 'failed', message);
          eventBus.emitAccountUpdate(jobId, account.id, { status: 'failed', error: message });
        } else if (failedMessages > 0) {
          accountQueries.updateStatus(account.id, 'completed', `Completed with ${failedMessages} failed messages`);
        } else {
          accountQueries.updateStatus(account.id, 'completed');
        }
        if (this.failedFolders.length === 0) {
          eventBus.emitAccountUpdate(jobId, account.id, { status: 'completed' });
        }
      }
    } catch (err) {
      logger.error(`Migration failed for ${account.src_email}`, { error: err.message });
      accountQueries.updateStatus(account.id, 'failed', err.message);
      errorQueries.create(account.id, {
        errorType: 'connection',
        errorMessage: err.message,
        retryable: true,
      });
      eventBus.emitAccountUpdate(jobId, account.id, { status: 'failed', error: err.message });
    } finally {
      await this.disconnect();
    }
  }

  recordFailedMessage(folderPath, uid, message, { retryable = true } = {}) {
    const { account, jobId } = this;

    logger.warn(`Failed to migrate message UID ${uid} in ${folderPath}`, {
      accountId: account.id,
      error: message,
    });

    folderQueries.incrementFailed(account.id, folderPath);
    accountQueries.incrementFailed(account.id);

    errorQueries.create(account.id, {
      folderPath,
      messageUid: uid,
      errorType: 'message',
      errorMessage: message,
      retryable,
    });

    eventBus.emitError(jobId, account.id, {
      folderPath,
      messageUid: uid,
      error: message,
    });
  }

  // Fetch a batch of messages. If the source drops the connection while doing so, split the
  // batch in half and retry until the UID that makes the server drop it is found, so one bad
  // message does not stop the whole folder.
  async fetchBatch(folderPath, uids) {
    try {
      return await this.srcClient.fetchMessages(uids.join(','), {});
    } catch (err) {
      if (!isConnectionError(err) || this.cancelled) throw err;

      await this.ensureConnected();
      await this.srcClient.openFolder(folderPath);

      if (uids.length === 1) {
        if (++this.poisonedInFolder > MAX_POISONED_PER_FOLDER) {
          throw new Error(`The source server keeps dropping the connection when fetching messages from ${folderPath}`);
        }
        this.recordFailedMessage(
          folderPath,
          uids[0],
          'The source server closes the connection when this message is fetched',
          { retryable: false }
        );
        return [];
      }

      logger.warn(`Source dropped the connection fetching UIDs ${uids[0]}-${uids[uids.length - 1]} in ${folderPath}, splitting the batch`, {
        accountId: this.account.id,
      });
      const mid = Math.ceil(uids.length / 2);
      return [
        ...(await this.fetchBatch(folderPath, uids.slice(0, mid))),
        ...(await this.fetchBatch(folderPath, uids.slice(mid))),
      ];
    }
  }

  async migrateFolder(folderPath, attempt = 0) {
    const { account, jobId } = this;
    if (attempt === 0) this.poisonedInFolder = 0;

    try {
      accountQueries.updateProgress(account.id, { currentFolder: folderPath });
      eventBus.emitAccountUpdate(jobId, account.id, { currentFolder: folderPath });

      const srcMailbox = await this.srcClient.openFolder(folderPath);
      const uidValidity = srcMailbox.uidValidity;
      const fullSync = shouldFullSync(account.id, folderPath, uidValidity);
      const lastUid = fullSync ? 0 : getLastUid(account.id, folderPath);
      const range = buildFetchRange(lastUid);

      // Initialize folder state
      folderQueries.upsert(account.id, folderPath, {
        uidValidity,
        lastUid,
        totalMessages: srcMailbox.exists || 0,
        migratedMessages: 0,
        failedMessages: 0,
        skippedMessages: 0,
        status: 'running',
      });

      eventBus.emitFolderUpdate(jobId, account.id, folderPath, {
        status: 'running',
        totalMessages: srcMailbox.exists || 0,
      });

      // Nothing new since the last sync (UIDNEXT hasn't moved past last_uid)
      if (!fullSync && srcMailbox.uidNext && lastUid + 1 >= srcMailbox.uidNext) {
        folderQueries.updateStatus(account.id, folderPath, 'completed');
        eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'completed' });
        return;
      }

      if (srcMailbox.exists === 0) {
        folderQueries.updateStatus(account.id, folderPath, 'completed');
        eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'completed' });
        return;
      }

      // Open destination folder
      await this.dstClient.openFolder(folderPath);

      // UIDs still to copy (`N:*` always returns the last message even when its UID < N)
      const uids = (await this.srcClient.searchUids(range)).filter((uid) => uid > lastUid);

      // Fetch in small batches: a single FETCH for the whole folder keeps every message in
      // memory and overloads the source server on large folders
      for (let i = 0; i < uids.length; i += FETCH_BATCH_SIZE) {
        if (this.cancelled) break;
        const messages = await this.fetchBatch(folderPath, uids.slice(i, i + FETCH_BATCH_SIZE));
        logger.info(`${folderPath}: copying messages ${i + 1}-${Math.min(i + FETCH_BATCH_SIZE, uids.length)} of ${uids.length}`, {
          accountId: account.id,
        });

        // Append each message
        for (const msg of messages) {
          if (this.cancelled) break;
          await this.waitIfPaused();

          try {
            await retryMessage(
              () => this.dstClient.appendMessage(folderPath, msg.source, msg.flags, msg.internalDate),
              { maxRetries: 2, label: `Message UID ${msg.uid} in ${folderPath}` }
            );

            folderQueries.incrementMigrated(account.id, folderPath);
            folderQueries.updateLastUid(account.id, folderPath, msg.uid);
            accountQueries.incrementMigrated(account.id);
            this.migratedCount++;

            eventBus.emitAccountUpdate(jobId, account.id, {
              migratedMessages: this.migratedCount,
            });
          } catch (err) {
            // A dropped connection is handled per folder (reconnect + rerun), not per message
            if (isConnectionError(err)) throw err;

            this.recordFailedMessage(folderPath, msg.uid, err.message);
          }
        }
      }

      folderQueries.updateStatus(account.id, folderPath, 'completed');
      eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'completed' });
    } catch (err) {
      // imapflow reports only "Command failed"; the server's reason is in responseText
      const reason = err.responseText ? `${err.message}: ${err.responseText}` : err.message;

      // The server dropped a connection: reconnect and run the folder again (already copied
      // messages are skipped because last_uid is stored after every message)
      if (isConnectionError(err) && attempt < config.folderRetries && !this.cancelled) {
        logger.warn(`Connection lost in ${folderPath}, retrying folder (attempt ${attempt + 1}/${config.folderRetries})`, {
          accountId: account.id,
          error: reason,
        });
        // Back off a little more each time; a server that throttles needs a pause, not a hammer
        await new Promise((resolve) => setTimeout(resolve, FOLDER_RETRY_DELAY_MS * (attempt + 1)));
        await this.ensureConnected();
        return this.migrateFolder(folderPath, attempt + 1);
      }

      this.failedFolders.push(folderPath);
      logger.error(`Failed to migrate folder ${folderPath}`, { accountId: account.id, error: reason });
      folderQueries.updateStatus(account.id, folderPath, 'failed');
      errorQueries.create(account.id, {
        folderPath,
        errorType: 'folder',
        errorMessage: reason,
        retryable: true,
      });
      eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'failed', error: reason });
    }
  }

  async disconnect() {
    try { await this.srcClient?.disconnect(); } catch { /* ignore */ }
    try { await this.dstClient?.disconnect(); } catch { /* ignore */ }
  }
}
