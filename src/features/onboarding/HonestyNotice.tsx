import { ShieldCheck, X } from 'lucide-react';

import { setNotice, useNotices } from '../../store/noticesStore';

/**
 * One-time, non-blocking first-run disclosure (FND-05, Pitfall M13). An
 * honesty notice — not a cookie banner: persistence IS the requested service.
 */
export function HonestyNotice() {
  const { honestyDismissed } = useNotices();
  if (honestyDismissed) return null;

  return (
    <div
      role="note"
      className="w-full max-w-xl mx-auto mb-4 bg-surface border border-border rounded-xl p-4 flex items-start gap-3"
    >
      <ShieldCheck
        aria-hidden="true"
        size={20}
        style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
      />
      <p className="flex-1 text-ink" style={{ fontSize: '14px', lineHeight: 1.5 }}>
        Your photos stay on this device — nothing is sent to a server.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setNotice({ honestyDismissed: true })}
        className="min-w-[44px] min-h-[44px] -my-2 -mr-2 text-ink-mut flex items-center justify-center"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
