import { useEffect, useRef } from 'react';

export function useSSE(jobId, handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!jobId) return;

    const url = `/api/events?job_id=${jobId}`;
    const source = new EventSource(url);

    source.addEventListener('job:update', (e) => {
      handlersRef.current.onJobUpdate?.(JSON.parse(e.data));
    });

    source.addEventListener('account:update', (e) => {
      handlersRef.current.onAccountUpdate?.(JSON.parse(e.data));
    });

    source.addEventListener('folder:update', (e) => {
      handlersRef.current.onFolderUpdate?.(JSON.parse(e.data));
    });

    source.addEventListener('migration:error', (e) => {
      handlersRef.current.onError?.(JSON.parse(e.data));
    });

    return () => source.close();
  }, [jobId]);
}
