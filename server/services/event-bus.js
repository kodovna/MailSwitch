import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  emitJobUpdate(jobId, data) {
    this.emit('job:update', { jobId, ...data });
  }

  emitAccountUpdate(jobId, accountId, data) {
    this.emit('account:update', { jobId, accountId, ...data });
  }

  emitFolderUpdate(jobId, accountId, folderPath, data) {
    this.emit('folder:update', { jobId, accountId, folderPath, ...data });
  }

  emitError(jobId, accountId, data) {
    this.emit('migration:error', { jobId, accountId, ...data });
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(100);
