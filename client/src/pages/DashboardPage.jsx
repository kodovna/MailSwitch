import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMigrationState } from '../hooks/useMigrationState';
import OverallProgress from '../components/OverallProgress';
import AccountTable from '../components/AccountTable';
import SyncToggle from '../components/SyncToggle';
import SyncCountdown from '../components/SyncCountdown';
import ConfirmDialog from '../components/ConfirmDialog';
import { api } from '../lib/api';

export default function DashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { job, accounts, loading, error, refetch } = useMigrationState(id);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

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

  async function handleRename() {
    try {
      await api.renameJob(job.id, nameDraft);
      refetch();
    } catch (err) {
      alert(err.message);
    }
    setEditingName(false);
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      await api.deleteJob(job.id);
      navigate('/jobs');
    } catch (err) {
      alert(err.message);
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
      <div className="mb-4">
        <Link to="/jobs" className="text-sm text-indigo-600 hover:underline">
          &larr; All Jobs
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          {editingName ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleRename(); }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
                maxLength={100}
                placeholder={`Job #${job.id}`}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-lg font-bold w-80"
              />
              <button type="submit" className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                Save
              </button>
              <button type="button" onClick={() => setEditingName(false)} className="text-sm text-gray-500 hover:underline">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold">{job.name || `Job #${job.id}`}</h1>
              {job.name && <span className="text-sm text-gray-400">#{job.id}</span>}
              <button
                onClick={() => { setNameDraft(job.name || ''); setEditingName(true); }}
                className="text-sm text-indigo-600 hover:underline"
              >
                Rename
              </button>
            </div>
          )}
          {job.src_host && (
            <p className="text-sm text-gray-500 mt-1">
              {job.src_host}:{job.src_port}
              {job.src_security && job.src_security !== 'ssl' && ` (${job.src_security.toUpperCase()})`}
              {' '}&rarr;{' '}
              {job.dst_host}:{job.dst_port}
              {job.dst_security && job.dst_security !== 'ssl' && ` (${job.dst_security.toUpperCase()})`}
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
              {job.syncing && <SyncCountdown nextSyncAt={job.nextSyncAt} />}
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

          <button
            onClick={() => setConfirmAction('delete')}
            disabled={actionLoading}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
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

      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete Job"
        message="The job, its accounts and error log will be permanently deleted. Already migrated mail stays in the destination."
        onConfirm={handleDelete}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
