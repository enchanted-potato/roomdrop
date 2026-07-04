import { Info, TriangleAlert, X } from 'lucide-react';
import type { ToastSpec } from '../store/toastStore';

export interface ToastProps {
  toast: ToastSpec;
  onDismiss: () => void;
}

/**
 * Single-slot toast per UI-SPEC. Variant-colored left accent bar + icon,
 * title (label role 14px bold), body (body role 16px), optional action button
 * (Phase 2 delete-undo), dismiss button (44x44).
 * React text rendering auto-escapes (T-01-02-04 mitigation).
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const isError = toast.variant === 'error';
  const accent = isError ? 'var(--danger)' : 'var(--accent)';
  const Icon = isError ? TriangleAlert : Info;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={
        'fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-md bg-surface border-l-4 rounded-md shadow-lg p-4 flex items-start gap-3 z-50 ' +
        (isError ? 'border-danger' : 'border-accent')
      }
    >
      <Icon aria-hidden="true" size={20} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
      <div className="flex-1">
        <p style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.4 }}>{toast.title}</p>
        {toast.body && (
          <p className="text-ink mt-1" style={{ fontSize: '16px', lineHeight: 1.5 }}>
            {toast.body}
          </p>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction();
            onDismiss();
          }}
          className="min-h-[44px] px-3 font-bold text-accent"
          style={{ fontSize: '14px' }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="min-w-[44px] min-h-[44px] text-ink-mut flex items-center justify-center"
      >
        <X aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
