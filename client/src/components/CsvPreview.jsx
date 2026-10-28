import Icon from './Icon';

function AuthIcon({ status, error }) {
  if (!status) return <span className="text-gray-300">--</span>;
  if (status === 'loading') return <Icon name="spinner" className="inline w-4 h-4 text-indigo-500" />;
  if (status === 'success') {
    return <Icon name="check-circle" className="inline w-5 h-5 text-green-600" />;
  }
  return (
    <span className="cursor-help" title={error || 'Failed'}>
      <Icon name="x-circle" className="inline w-5 h-5 text-red-600" />
    </span>
  );
}

export default function CsvPreview({ accounts, authResults }) {
  if (!accounts || accounts.length === 0) return null;

  const hasAuth = authResults && authResults.length > 0;

  return (
    <div className="mt-6 overflow-x-auto">
      <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
        <Icon name="users" className="w-5 h-5 text-gray-400" />
        Preview ({accounts.length} account{accounts.length !== 1 ? 's' : ''})
      </h3>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Source Email</th>
            {hasAuth && <th className="px-4 py-2 text-center font-medium text-gray-500">Src Auth</th>}
            <th className="px-4 py-2 text-left font-medium text-gray-500">Dest Email</th>
            {hasAuth && <th className="px-4 py-2 text-center font-medium text-gray-500">Dst Auth</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((a, i) => {
            const auth = hasAuth ? authResults[i] : null;
            return (
              <tr key={i} className={`hover:bg-gray-50 ${auth && (auth.src === 'error' || auth.dst === 'error') ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2">{a.src_email}</td>
                {hasAuth && (
                  <td className="px-4 py-2 text-center">
                    <AuthIcon status={auth?.src} error={auth?.srcError} />
                  </td>
                )}
                <td className="px-4 py-2">{a.dst_email}</td>
                {hasAuth && (
                  <td className="px-4 py-2 text-center">
                    <AuthIcon status={auth?.dst} error={auth?.dstError} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
