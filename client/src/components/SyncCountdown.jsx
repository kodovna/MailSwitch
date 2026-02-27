import { useState, useEffect } from 'react';

export default function SyncCountdown({ nextSyncAt }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!nextSyncAt) {
      setRemaining(null);
      return;
    }

    function tick() {
      const diff = Math.max(0, Math.round((new Date(nextSyncAt) - Date.now()) / 1000));
      setRemaining(diff);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextSyncAt]);

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <span className="text-xs text-gray-500 tabular-nums">
      {remaining === 0 ? 'Syncing...' : `Next sync in ${display}`}
    </span>
  );
}
