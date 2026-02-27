import { percent, formatDuration } from '../lib/format';
import StatusBadge from './StatusBadge';

export default function OverallProgress({ job, accounts }) {
  const totalMessages = accounts.reduce((s, a) => s + (a.total_messages || 0), 0);
  const migratedMessages = accounts.reduce((s, a) => s + (a.migrated_messages || 0), 0);
  const failedMessages = accounts.reduce((s, a) => s + (a.failed_messages || 0), 0);
  const pct = percent(migratedMessages, totalMessages);

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Migration Progress</h2>
        <StatusBadge status={job.status} />
      </div>

      <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
        <div
          className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Accounts</p>
          <p className="text-xl font-semibold">{job.completed_accounts}/{job.total_accounts}</p>
        </div>
        <div>
          <p className="text-gray-500">Messages</p>
          <p className="text-xl font-semibold">{migratedMessages.toLocaleString()}/{totalMessages.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">Failed</p>
          <p className="text-xl font-semibold text-red-600">{failedMessages.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">Duration</p>
          <p className="text-xl font-semibold">{formatDuration(job.started_at, job.finished_at)}</p>
        </div>
      </div>
    </div>
  );
}
