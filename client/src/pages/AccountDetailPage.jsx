import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSSE } from '../hooks/useSSE';
import { api } from '../lib/api';
import { percent, formatDuration } from '../lib/format';
import StatusBadge from '../components/StatusBadge';
import FolderProgress from '../components/FolderProgress';
import ErrorLog from '../components/ErrorLog';
import Icon from '../components/Icon';

export default function AccountDetailPage() {
  const { id } = useParams();
  const [account, setAccount] = useState(null);
  const [folders, setFolders] = useState([]);
  const [errors, setErrors] = useState([]);
  const [errorTotal, setErrorTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [acct, errData] = await Promise.all([
        api.getAccount(id),
        api.getAccountErrors(id),
      ]);
      setAccount(acct);
      setFolders(acct.folders || []);
      setErrors(errData.errors);
      setErrorTotal(errData.total);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useSSE(account?.job_id, {
    onAccountUpdate(data) {
      if (data.accountId === Number(id)) {
        setAccount((prev) => (prev ? { ...prev, ...data } : prev));
      }
    },
    onFolderUpdate(data) {
      if (data.accountId === Number(id)) {
        setFolders((prev) =>
          prev.map((f) =>
            f.folder_path === data.folderPath ? { ...f, ...data } : f
          )
        );
      }
    },
    onError(data) {
      if (data.accountId === Number(id)) {
        fetchData();
      }
    },
  });

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!account) return <p className="text-gray-500">Account not found</p>;

  const pct = percent(account.migrated_messages, account.total_messages);

  return (
    <div>
      <div className="mb-6">
        <Link to={`/jobs/${account.job_id}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <Icon name="arrow-left" className="w-3.5 h-3.5" />
          Back to Job #{account.job_id}
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">{account.src_email}</h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={account.status} />
            {account.status === 'failed' && (
              <button
                onClick={async () => { await api.retryAccount(account.id); fetchData(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600"
              >
                <Icon name="refresh" />
                Retry
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-500">Source</p>
            <p className="font-medium">{account.src_host}:{account.src_port}</p>
          </div>
          <div>
            <p className="text-gray-500">Destination</p>
            <p className="font-medium">{account.dst_host}:{account.dst_port}</p>
          </div>
          <div>
            <p className="text-gray-500">Duration</p>
            <p className="font-medium">{formatDuration(account.started_at, account.finished_at)}</p>
          </div>
          <div>
            <p className="text-gray-500">Progress</p>
            <p className="font-medium">{pct}% ({account.migrated_messages}/{account.total_messages})</p>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {account.error_message && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {account.error_message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Folders</h2>
        <FolderProgress folders={folders} />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Error Log</h2>
        <ErrorLog errors={errors} total={errorTotal} />
      </div>
    </div>
  );
}
