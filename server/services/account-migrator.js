import { ImapClient } from './imap-client.js';
import { shouldFullSync, getLastUid, buildFetchRange } from './delta-sync.js';
import { accountQueries, folderQueries, errorQueries } from '../db/database.js';
import { eventBus } from './event-bus.js';
import { retry, retryMessage } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

const MAX_FOLDER_RETRIES = 2;
const FETCH_BATCH_SIZE = 25;

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

  async migrateFolder(folderPath, attempt = 0) {
    const { account, jobId } = this;

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
        const messages = await this.srcClient.fetchMessages(uids.slice(i, i + FETCH_BATCH_SIZE).join(','), {});

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

            logger.warn(`Failed to migrate message UID ${msg.uid} in ${folderPath}`, {
              accountId: account.id,
              error: err.message,
            });

            folderQueries.incrementFailed(account.id, folderPath);
            accountQueries.incrementFailed(account.id);

            errorQueries.create(account.id, {
              folderPath,
              messageUid: msg.uid,
              errorType: 'message',
              errorMessage: err.message,
              retryable: true,
            });

            eventBus.emitError(jobId, account.id, {
              folderPath,
              messageUid: msg.uid,
              error: err.message,
            });
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
      if (isConnectionError(err) && attempt < MAX_FOLDER_RETRIES && !this.cancelled) {
        logger.warn(`Connection lost in ${folderPath}, retrying folder (attempt ${attempt + 1}/${MAX_FOLDER_RETRIES})`, {
          accountId: account.id,
          error: reason,
        });
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
