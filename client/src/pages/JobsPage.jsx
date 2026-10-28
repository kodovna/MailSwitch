import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatDuration, percent } from '../lib/format';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getJobs().then(setJobs).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Migration Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{jobs.length} job{jobs.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <Icon name="plus" />
          New Migration
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Icon name="inbox" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 text-lg font-medium">No migration jobs yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">Start by configuring your servers and uploading a CSV</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Icon name="plus" />
            Start First Migration
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, index) => {
            const pct = percent(job.completed_accounts, job.total_accounts);
            const num = jobs.length - index;
            return (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex">
                  {/* Job number sidebar */}
                  <div className="flex items-center justify-center w-16 bg-gray-50 rounded-l-lg border-r border-gray-100 shrink-0">
                    <span className="text-lg font-bold text-gray-400">#{num}</span>
                  </div>

                  <div className="flex-1 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={job.status} />
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          <Icon name={job.mode === 'continuous' ? 'refresh' : 'arrow-right'} className="w-3 h-3" />
                          {job.mode === 'continuous' ? 'Continuous' : 'One-time'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(job.created_at)}</span>
                    </div>

                    {job.name && <p className="text-base font-semibold text-gray-900 mb-1">{job.name}</p>}
                    <p className={`flex items-center gap-1.5 text-sm font-medium mb-3 ${job.name ? 'text-gray-500' : 'text-gray-700'}`}>
                      <Icon name="server" className="w-4 h-4 text-gray-400" />
                      {job.src_host}:{job.src_port} &rarr; {job.dst_host}:{job.dst_port}
                    </p>

                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          job.status === 'failed' ? 'bg-red-500'
                            : job.status === 'completed' ? 'bg-green-500'
                              : 'bg-indigo-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-5 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="users" className="w-3.5 h-3.5" />
                        {job.completed_accounts}/{job.total_accounts} accounts
                      </span>
                      {job.failed_accounts > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <Icon name="exclamation-triangle" className="w-3.5 h-3.5" />
                          {job.failed_accounts} failed
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Icon name="clock" className="w-3.5 h-3.5" />
                        {formatDuration(job.started_at, job.finished_at)}
                      </span>
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div className="flex items-center px-4 text-gray-300">
                    <Icon name="chevron-right" className="w-5 h-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
