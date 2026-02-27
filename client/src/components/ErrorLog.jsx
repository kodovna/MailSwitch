import { formatDate } from '../lib/format';

export default function ErrorLog({ errors, total }) {
  if (!errors || errors.length === 0) {
    return <p className="text-gray-500 text-sm">No errors recorded.</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-2">{total} total error{total !== 1 ? 's' : ''}</p>
      <div className="max-h-96 overflow-y-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Time</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Folder</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">UID</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {errors.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatDate(e.created_at)}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.folder_path || '-'}</td>
                <td className="px-4 py-2">{e.message_uid || '-'}</td>
                <td className="px-4 py-2">{e.error_type}</td>
                <td className="px-4 py-2 text-red-600 max-w-xs truncate">{e.error_message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
