import { useNavigate } from 'react-router-dom';
import { percent } from '../lib/format';
import StatusBadge from './StatusBadge';

export default function AccountRow({ account }) {
  const navigate = useNavigate();
  const pct = percent(account.migrated_messages, account.total_messages);

  return (
    <tr
      onClick={() => navigate(`/accounts/${account.id}`)}
      className="hover:bg-gray-50 cursor-pointer"
    >
      <td className="px-4 py-3 text-sm">{account.src_email}</td>
      <td className="px-4 py-3 text-sm">{account.dst_email}</td>
      <td className="px-4 py-3">
        <StatusBadge status={account.status} />
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {account.migrated_messages}/{account.total_messages}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">
        {account.current_folder || '-'}
      </td>
    </tr>
  );
}
