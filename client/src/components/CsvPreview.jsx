export default function CsvPreview({ accounts }) {
  if (!accounts || accounts.length === 0) return null;

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
            <th className="px-4 py-2 text-left font-medium text-gray-500">Source Host</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Port</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Dest Email</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Dest Host</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Port</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((a, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-400">{i + 1}</td>
              <td className="px-4 py-2">{a.src_email}</td>
              <td className="px-4 py-2 text-gray-600">{a.src_host}</td>
              <td className="px-4 py-2 text-gray-600">{a.src_port}</td>
              <td className="px-4 py-2">{a.dst_email}</td>
              <td className="px-4 py-2 text-gray-600">{a.dst_host}</td>
              <td className="px-4 py-2 text-gray-600">{a.dst_port}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
