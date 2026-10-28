import { percent } from '../lib/format';
import StatusBadge from './StatusBadge';
import Icon from './Icon';

export default function FolderProgress({ folders }) {
  if (!folders || folders.length === 0) {
    return <p className="text-gray-500 text-sm">No folder data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Folder</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Progress</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Migrated</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Failed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {folders.map((f) => {
            const pct = percent(f.migrated_messages, f.total_messages);
            return (
              <tr key={f.id}>
                <td className="px-4 py-2 font-mono text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="folder" className="w-3.5 h-3.5 text-gray-400" />
                    {f.folder_path}
                  </span>
                </td>
                <td className="px-4 py-2"><StatusBadge status={f.status} /></td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-2">{f.migrated_messages}/{f.total_messages}</td>
                <td className="px-4 py-2 text-red-600">{f.failed_messages}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
