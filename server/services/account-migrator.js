import { ImapClient } from './imap-client.js';
import { shouldFullSync, getLastUid, buildFetchRange } from './delta-sync.js';
import { accountQueries, folderQueries, errorQueries } from '../db/database.js';
import { eventBus } from './event-bus.js';
import { retry, retryMessage } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

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

  async migrate() {
    const { account, jobId } = this;
    logger.info(`Starting migration for ${account.src_email}`, { accountId: account.id });

    accountQueries.updateStatus(account.id, 'running');
    eventBus.emitAccountUpdate(jobId, account.id, { status: 'running' });

    try {
      // Connect to both servers with retry (host/port/security from job-level config)
      const { src_host, src_port, src_security, dst_host, dst_port, dst_security } = this.job;

      this.srcClient = await retry(
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

      this.dstClient = await retry(
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
        await this.migrateFolder(folder.path);
      }

      if (this.cancelled) {
        accountQueries.updateStatus(account.id, 'cancelled');
        eventBus.emitAccountUpdate(jobId, account.id, { status: 'cancelled' });
      } else {
        const failedMessages = accountQueries.getFailedCount(account.id);
        if (failedMessages > 0) {
          accountQueries.updateStatus(account.id, 'completed', `Completed with ${failedMessages} failed messages`);
        } else {
          accountQueries.updateStatus(account.id, 'completed');
        }
        eventBus.emitAccountUpdate(jobId, account.id, { status: 'completed' });
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

  async migrateFolder(folderPath) {
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

      if (srcMailbox.exists === 0) {
        folderQueries.updateStatus(account.id, folderPath, 'completed');
        eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'completed' });
        return;
      }

      // Fetch messages from source
      let messages;
      try {
        messages = await this.srcClient.fetchMessages(range, {});
      } catch (err) {
        // No messages in range (e.g., range is beyond existing UIDs)
        if (err.message?.includes('does not exist') || err.message?.includes('Nothing to fetch')) {
          folderQueries.updateStatus(account.id, folderPath, 'completed');
          return;
        }
        throw err;
      }

      // Open destination folder
      await this.dstClient.openFolder(folderPath);

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

      folderQueries.updateStatus(account.id, folderPath, 'completed');
      eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'completed' });
    } catch (err) {
      logger.error(`Failed to migrate folder ${folderPath}`, { accountId: account.id, error: err.message });
      folderQueries.updateStatus(account.id, folderPath, 'failed');
      errorQueries.create(account.id, {
        folderPath,
        errorType: 'folder',
        errorMessage: err.message,
        retryable: true,
      });
      eventBus.emitFolderUpdate(jobId, account.id, folderPath, { status: 'failed', error: err.message });
    }
  }

  async disconnect() {
    try { await this.srcClient?.disconnect(); } catch { /* ignore */ }
    try { await this.dstClient?.disconnect(); } catch { /* ignore */ }
  }
}
