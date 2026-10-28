import { useState, useEffect } from 'react';
import Icon from './Icon';

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
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 tabular-nums">
      <Icon name={remaining === 0 ? 'spinner' : 'clock'} className="w-3.5 h-3.5" />
      {remaining === 0 ? 'Syncing...' : `Next sync in ${display}`}
    </span>
  );
}
