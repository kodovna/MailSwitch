export default function SyncToggle({ syncing, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        syncing ? 'bg-indigo-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          syncing ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
