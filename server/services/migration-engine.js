import { AsyncQueue } from './queue.js';
import { AccountMigrator } from './account-migrator.js';
import { jobQueries, accountQueries } from '../db/database.js';
import { eventBus } from './event-bus.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

class MigrationEngine {
  constructor() {
    this.queues = new Map();        // jobId -> AsyncQueue
    this.migrators = new Map();     // accountId -> AccountMigrator
    this.syncTimers = new Map();    // jobId -> timer
    this.nextSyncAt = new Map();    // jobId -> ISO timestamp
  }

  async startJob(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'running') throw new Error('Job is already running');

    jobQueries.updateStatus(jobId, 'running');
    eventBus.emitJobUpdate(jobId, { status: 'running' });

    const queue = new AsyncQueue(config.maxConcurrentAccounts);
    this.queues.set(jobId, queue);

    const accounts = accountQueries.getPendingByJobIdDecrypted(jobId);
    if (accounts.length === 0) {
      jobQueries.updateStatus(jobId, 'completed');
      eventBus.emitJobUpdate(jobId, { status: 'completed' });
      return;
    }

    const promises = accounts.map((account) =>
      queue.push(async () => {
        const migrator = new AccountMigrator(account, job);
        this.migrators.set(account.id, migrator);
        try {
          await migrator.migrate();
        } finally {
          this.migrators.delete(account.id);
        }
      })
    );

    // Wait for all accounts to finish (or be cancelled)
    try {
      await Promise.allSettled(promises);
    } catch {
      // queue cleared
    }

    // Update job status
    const updatedJob = jobQueries.getById(jobId);
    if (updatedJob.status === 'running') {
      jobQueries.updateCounts(jobId);
      const finalJob = jobQueries.getById(jobId);

      if (finalJob.failed_accounts > 0 && finalJob.completed_accounts + finalJob.failed_accounts >= finalJob.total_accounts) {
        jobQueries.updateStatus(jobId, 'completed');
      } else if (finalJob.completed_accounts >= finalJob.total_accounts) {
        jobQueries.updateStatus(jobId, 'completed');
      }

      eventBus.emitJobUpdate(jobId, { status: jobQueries.getById(jobId).status });
    }

    this.queues.delete(jobId);

    // Start continuous sync after initial migration (not if already syncing)
    if (job.mode === 'continuous' && !this.isSyncing(jobId) && updatedJob.status !== 'cancelled') {
      this.startContinuousSync(jobId);
    }
  }

  pauseJob(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job || job.status !== 'running') throw new Error('Job is not running');

    const queue = this.queues.get(jobId);
    if (queue) queue.pause();

    // Pause all active migrators for this job
    for (const [accountId, migrator] of this.migrators) {
      if (migrator.jobId === jobId) {
        migrator.pause();
        accountQueries.updateStatus(accountId, 'paused');
      }
    }

    jobQueries.updateStatus(jobId, 'paused');
    eventBus.emitJobUpdate(jobId, { status: 'paused' });
  }

  resumeJob(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job || job.status !== 'paused') throw new Error('Job is not paused');

    const queue = this.queues.get(jobId);

    // Resume active migrators
    for (const [accountId, migrator] of this.migrators) {
      if (migrator.jobId === jobId) {
        migrator.resume();
        accountQueries.updateStatus(accountId, 'running');
      }
    }

    if (!queue) {
      // Nothing is running in memory (e.g. server restarted while paused): start over
      // from the DB state. startJob refuses a job that is already 'running'.
      accountQueries.resetStale(jobId);
      jobQueries.updateStatus(jobId, 'pending');
      this.startJob(jobId).catch((err) => {
        logger.error(`Failed to restart job ${jobId}`, { error: err.message });
      });
      return;
    }

    jobQueries.updateStatus(jobId, 'running');
    eventBus.emitJobUpdate(jobId, { status: 'running' });
    queue.resume();
  }

  cancelJob(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job) throw new Error('Job not found');

    this.stopContinuousSync(jobId);

    const queue = this.queues.get(jobId);
    if (queue) queue.clear();

    // Cancel all active migrators
    for (const [accountId, migrator] of this.migrators) {
      if (migrator.jobId === jobId) {
        migrator.cancel();
      }
    }

    // Cancel pending accounts
    const pending = accountQueries.getPendingByJobId(jobId);
    for (const account of pending) {
      accountQueries.updateStatus(account.id, 'cancelled');
    }

    jobQueries.updateStatus(jobId, 'cancelled');
    eventBus.emitJobUpdate(jobId, { status: 'cancelled' });
  }

  deleteJob(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job) throw new Error('Job not found');

    if (job.status !== 'cancelled') this.cancelJob(jobId);
    jobQueries.delete(jobId);
    eventBus.emitJobUpdate(jobId, { status: 'deleted' });
  }

  retryFailedAccounts(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job) throw new Error('Job not found');

    accountQueries.resetFailed(jobId);
    jobQueries.updateCounts(jobId);

    // Restart the job
    this.startJob(jobId);
  }

  resyncJob(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job) throw new Error('Job not found');

    accountQueries.resetCompleted(jobId);
    accountQueries.resetFailed(jobId);
    jobQueries.updateCounts(jobId);

    this.startJob(jobId);
  }

  retrySingleAccount(accountId) {
    const account = accountQueries.getById(accountId);
    if (!account) throw new Error('Account not found');

    accountQueries.resetSingleFailed(accountId);
    jobQueries.updateCounts(account.job_id);

    const job = jobQueries.getById(account.job_id);
    if (job.status !== 'running') {
      this.startJob(account.job_id);
    }
  }

  startContinuousSync(jobId) {
    const job = jobQueries.getById(jobId);
    if (!job) return;

    const interval = (job.sync_interval || config.syncInterval) * 1000;

    this.stopContinuousSync(jobId);

    const scheduleNext = () => {
      const nextAt = new Date(Date.now() + interval).toISOString();
      this.nextSyncAt.set(jobId, nextAt);
      eventBus.emitJobUpdate(jobId, { nextSyncAt: nextAt });

      const timer = setTimeout(async () => {
        try {
          const currentJob = jobQueries.getById(jobId);
          if (!currentJob || currentJob.status === 'cancelled') {
            this.syncTimers.delete(jobId);
            this.nextSyncAt.delete(jobId);
            return;
          }

          this.nextSyncAt.delete(jobId);
          eventBus.emitJobUpdate(jobId, { nextSyncAt: null });

          logger.info(`Running delta sync for job ${jobId}`);

          // Reset all completed accounts back to pending for delta sync
          const accounts = accountQueries.getByJobId(jobId);
          for (const account of accounts) {
            if (account.status === 'completed') {
              accountQueries.updateStatus(account.id, 'pending');
            }
          }
          jobQueries.updateStatus(jobId, 'pending');

          await this.startJob(jobId);
        } catch (err) {
          logger.error(`Delta sync failed for job ${jobId}`, { error: err.message });
        }

        // Always reschedule unless cancelled/stopped
        if (this.syncTimers.has(jobId)) {
          scheduleNext();
        }
      }, interval);

      this.syncTimers.set(jobId, timer);
    };

    scheduleNext();
    logger.info(`Continuous sync enabled for job ${jobId}, interval: ${interval / 1000}s`);
  }

  stopContinuousSync(jobId) {
    const timer = this.syncTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.syncTimers.delete(jobId);
      this.nextSyncAt.delete(jobId);
      logger.info(`Continuous sync disabled for job ${jobId}`);
    }
  }

  isSyncing(jobId) {
    return this.syncTimers.has(jobId);
  }

  shutdown() {
    for (const [jobId] of this.syncTimers) {
      this.stopContinuousSync(jobId);
    }
    for (const [, migrator] of this.migrators) {
      migrator.cancel();
    }
    for (const [, queue] of this.queues) {
      queue.clear();
    }
  }
}

export const migrationEngine = new MigrationEngine();
