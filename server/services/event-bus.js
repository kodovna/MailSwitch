import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Buffered progress updates per account, flushed every 500ms
    this._progressBuffer = new Map();
    this._flushInterval = setInterval(() => this._flushProgress(), 500);
    this._flushInterval.unref();
  }

  emitJobUpdate(jobId, data) {
    this.emit('job:update', { jobId, ...data });
  }

  emitAccountUpdate(jobId, accountId, data) {
    // Throttle pure progress updates (migratedMessages only)
    // Status changes, folder changes, and other updates go through immediately
    if (data.migratedMessages !== undefined && !data.status && !data.currentFolder && !data.totalMessages) {
      const key = `${jobId}:${accountId}`;
      this._progressBuffer.set(key, { jobId, accountId, ...data });
      return;
    }
    this.emit('account:update', { jobId, accountId, ...data });
  }

  emitFolderUpdate(jobId, accountId, folderPath, data) {
    this.emit('folder:update', { jobId, accountId, folderPath, ...data });
  }

  emitError(jobId, accountId, data) {
    this.emit('migration:error', { jobId, accountId, ...data });
  }

  _flushProgress() {
    if (this._progressBuffer.size === 0) return;
    for (const data of this._progressBuffer.values()) {
      this.emit('account:update', data);
    }
    this._progressBuffer.clear();
  }

  shutdown() {
    clearInterval(this._flushInterval);
    this._flushProgress();
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(200);
