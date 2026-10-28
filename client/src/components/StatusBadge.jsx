import Icon from './Icon';

const colors = {
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-500',
  skipped: 'bg-orange-100 text-orange-700',
};

const icons = {
  pending: 'clock',
  running: 'spinner',
  completed: 'check-circle',
  failed: 'x-circle',
  paused: 'pause-circle',
  cancelled: 'ban',
  skipped: 'forward',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}
    >
      <Icon name={icons[status] || icons.pending} className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}
