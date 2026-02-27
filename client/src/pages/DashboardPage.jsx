import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMigrationState } from '../hooks/useMigrationState';
import OverallProgress from '../components/OverallProgress';
import AccountTable from '../components/AccountTable';
import SyncToggle from '../components/SyncToggle';
import ConfirmDialog from '../components/ConfirmDialog';
import { api } from '../lib/api';

export default function DashboardPage() {
  const { id } = useParams();
  const { job, accounts, loading, error, refetch } = useMigrationState(id);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function runAction(fn) {
    setActionLoading(true);
    try {
      await fn();
      setTimeout(refetch, 500);
    } catch {
      // errors shown via SSE
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (!job) return <p className="text-gray-500">Job not found</p>;

  const isRunning = job.status === 'running';
  const isPaused = job.status === 'paused';
  const isActive = isRunning || isPaused;
  const hasFailedAccounts = accounts.some((a) => a.status === 'failed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Job #{job.id}</h1>
          {job.src_host && (
            <p className="text-sm text-gray-500 mt-1">
              {job.src_host}:{job.src_port} &rarr; {job.dst_host}:{job.dst_port}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {job.mode === 'continuous' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Continuous sync</span>
              <SyncToggle
                syncing={job.syncing}
                onToggle={() => runAction(() => api.toggleSync(job.id))}
                disabled={actionLoading}
              />
            </div>
          )}

          {(job.status === 'pending' || job.status === 'completed' || job.status === 'failed') && (
            <button
              onClick={() => runAction(() => api.startJob(job.id))}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {job.status === 'pending' ? 'Start' : 'Restart'}
            </button>
          )}

          {isPaused && (
            <button
              onClick={() => runAction(() => api.startJob(job.id))}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Resume
            </button>
          )}

          {isRunning && (
            <button
              onClick={() => runAction(() => api.pauseJob(job.id))}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200 disabled:opacity-50"
            >
              Pause
            </button>
          )}

          {isActive && (
            <button
              onClick={() => setConfirmAction('cancel')}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          {hasFailedAccounts && !isActive && (
            <button
              onClick={() => runAction(() => api.retryFailed(job.id))}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              Retry Failed
            </button>
          )}

          {job.mode === 'full' && job.status === 'completed' && (
            <button
              onClick={() => runAction(() => api.resyncJob(job.id))}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              Resync
            </button>
          )}
        </div>
      </div>

      <OverallProgress job={job} accounts={accounts} />
      <AccountTable accounts={accounts} />

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="Cancel Migration"
        message="Are you sure you want to cancel this migration? Running transfers will be stopped."
        onConfirm={() => runAction(() => api.cancelJob(job.id))}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
