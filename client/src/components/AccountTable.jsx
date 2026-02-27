import AccountRow from './AccountRow';

export default function AccountTable({ accounts }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Messages</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Folder</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
