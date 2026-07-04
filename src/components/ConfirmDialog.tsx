import { useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** Danger-filled confirm for irreversible actions. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal for the three destructive actions (PER-05). Initial
 * focus lands on Cancel so a stray double-tap can't confirm; Escape and
 * backdrop click cancel.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(58, 51, 44, 0.4)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="bg-surface rounded-2xl shadow-lg p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          style={{ fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: 1.2 }}
        >
          {title}
        </h2>
        <p className="text-ink-mut mt-2" style={{ fontSize: '16px', lineHeight: 1.5 }}>
          {body}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-md border border-border text-ink font-bold"
            style={{ fontSize: '14px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              'min-h-[44px] px-4 rounded-md text-white font-bold ' +
              (danger ? 'bg-danger' : 'bg-accent')
            }
            style={{ fontSize: '14px' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
