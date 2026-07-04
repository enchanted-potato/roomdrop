import { TriangleAlert, X } from 'lucide-react';

export interface SecondTabBannerProps {
  onDismiss: () => void;
}

/** Persistent warning under the header when RoomDrop is open elsewhere (PER-06). */
export function SecondTabBanner({ onDismiss }: SecondTabBannerProps) {
  return (
    <div
      role="alert"
      className="bg-surface border-b border-border px-4 py-2 flex items-center gap-3"
    >
      <TriangleAlert aria-hidden="true" size={18} style={{ color: 'var(--danger)' }} />
      <p className="flex-1 text-ink" style={{ fontSize: '14px', lineHeight: 1.4 }}>
        RoomDrop is open in another tab. Close one to avoid losing changes.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="min-w-[44px] min-h-[44px] text-ink-mut flex items-center justify-center"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
