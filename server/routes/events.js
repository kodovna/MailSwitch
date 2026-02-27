import { Router } from 'express';
import { eventBus } from '../services/event-bus.js';

const router = Router();

router.get('/', (req, res) => {
  const jobId = req.query.job_id ? Number(req.query.job_id) : null;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(':\n\n'); // SSE comment to establish connection

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onJobUpdate = (data) => {
    if (!jobId || data.jobId === jobId) send('job:update', data);
  };
  const onAccountUpdate = (data) => {
    if (!jobId || data.jobId === jobId) send('account:update', data);
  };
  const onFolderUpdate = (data) => {
    if (!jobId || data.jobId === jobId) send('folder:update', data);
  };
  const onError = (data) => {
    if (!jobId || data.jobId === jobId) send('migration:error', data);
  };

  eventBus.on('job:update', onJobUpdate);
  eventBus.on('account:update', onAccountUpdate);
  eventBus.on('folder:update', onFolderUpdate);
  eventBus.on('migration:error', onError);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('job:update', onJobUpdate);
    eventBus.off('account:update', onAccountUpdate);
    eventBus.off('folder:update', onFolderUpdate);
    eventBus.off('migration:error', onError);
  });
});

export default router;
