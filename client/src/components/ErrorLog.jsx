import { formatDate } from '../lib/format';
import Icon from './Icon';

export default function ErrorLog({ errors, total }) {
  if (!errors || errors.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-gray-500 text-sm">
        <Icon name="check-circle" className="w-4 h-4 text-green-500" />
        No errors recorded.
      </p>
    );
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
        <Icon name="exclamation-triangle" className="w-4 h-4 text-red-500" />
        {total} total error{total !== 1 ? 's' : ''}
      </p>
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
                <td className="px-4 py-2 font-mono text-xs">
                  {e.folder_path ? (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="folder" className="w-3.5 h-3.5 text-gray-400" />
                      {e.folder_path}
                    </span>
                  ) : '-'}
                </td>
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
