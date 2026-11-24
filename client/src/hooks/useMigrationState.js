import { useState, useCallback, useEffect } from 'react';
import { useSSE } from './useSSE';
import { api } from '../lib/api';
import { normalizeAccountData } from '../lib/normalize';

export function useMigrationState(jobId) {
  const [job, setJob] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJob = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getJob(jobId);
      setJob(data);
      setAccounts(data.accounts || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) fetchJob();
  }, [jobId, fetchJob]);

  useSSE(jobId, {
    onJobUpdate(data) {
      setJob((prev) => (prev ? { ...prev, ...data } : prev));
      // Refetch full data on job status changes to get updated counts
      if (data.status) {
        setTimeout(fetchJob, 300);
      }
    },
    onAccountUpdate(data) {
      const normalized = normalizeAccountData(data);
      setAccounts((prev) =>
        prev.map((a) => (a.id === normalized.accountId ? { ...a, ...normalized } : a))
      );
    },
  });

  return { job, accounts, loading, error, refetch: fetchJob };
}
