import { percent, formatDuration } from '../lib/format';
import StatusBadge from './StatusBadge';

function parseDate(str) {
  if (!str) return null;
  if (str.includes('T')) return new Date(str);
  return new Date(str.replace(' ', 'T') + 'Z');
}

function formatRemaining(migratedMessages, totalMessages, startedAt) {
  if (!startedAt || migratedMessages === 0 || totalMessages === 0) return '-';
  const start = parseDate(startedAt);
  if (!start) return '-';
  const elapsed = (Date.now() - start.getTime()) / 1000;
  if (elapsed < 2) return 'calculating...';
  const rate = migratedMessages / elapsed;
  const remaining = (totalMessages - migratedMessages) / rate;
  if (remaining <= 0) return '-';
  if (remaining < 60) return `~${Math.ceil(remaining)}s`;
  if (remaining < 3600) return `~${Math.ceil(remaining / 60)}m`;
  return `~${Math.floor(remaining / 3600)}h ${Math.ceil((remaining % 3600) / 60)}m`;
}

export default function OverallProgress({ job, accounts }) {
  const totalMessages = accounts.reduce((s, a) => s + (a.total_messages || 0), 0);
  const migratedMessages = accounts.reduce((s, a) => s + (a.migrated_messages || 0), 0);
  const failedMessages = accounts.reduce((s, a) => s + (a.failed_messages || 0), 0);
  const pct = percent(migratedMessages, totalMessages);

  // Compute account-level counts from live data
  const completedAccounts = accounts.filter((a) => a.status === 'completed').length;
  const failedAccounts = accounts.filter((a) => a.status === 'failed').length;

  const isRunning = job.status === 'running';
  const remaining = isRunning
    ? formatRemaining(migratedMessages, totalMessages, job.started_at)
    : null;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Migration Progress</h2>
        <StatusBadge status={job.status} />
      </div>

      <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
        <div
          className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        <span>{pct}%</span>
        {remaining && <span>{remaining} remaining</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Accounts</p>
          <p className="text-xl font-semibold">{completedAccounts}/{job.total_accounts}</p>
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
        <div>
          <p className="text-gray-500">Failed Accounts</p>
          <p className="text-xl font-semibold text-red-600">{failedAccounts}</p>
        </div>
      </div>
    </div>
  );
}
