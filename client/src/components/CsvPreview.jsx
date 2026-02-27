function AuthIcon({ status, error }) {
  if (!status) return <span className="text-gray-300">--</span>;
  if (status === 'loading') return <span className="text-indigo-500 animate-pulse">...</span>;
  if (status === 'success') {
    return <span className="text-green-600" title="Authenticated">&#10003;</span>;
  }
  return <span className="text-red-600 cursor-help" title={error || 'Failed'}>&#10007;</span>;
}

export default function CsvPreview({ accounts, authResults }) {
  if (!accounts || accounts.length === 0) return null;

  const hasAuth = authResults && authResults.length > 0;

  return (
    <div className="mt-6 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-3">
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
