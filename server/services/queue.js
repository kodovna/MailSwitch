export class AsyncQueue {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.paused = false;
  }

  push(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._process();
    });
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this._process();
  }

  clear() {
    const pending = this.queue.splice(0);
    for (const item of pending) {
      item.reject(new Error('Queue cleared'));
    }
  }

  get pending() {
    return this.queue.length;
  }

  get active() {
    return this.running;
  }

  get idle() {
    return this.running === 0 && this.queue.length === 0;
  }

  _process() {
    if (this.paused) return;
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      this.running++;
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._process();
        });
    }
  }
}
