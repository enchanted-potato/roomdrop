import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { clearAllBlobs } from '../lib/idb';
import { useAppStore } from '../store/useAppStore';

type PendingAction = 'clear' | 'change' | 'reset' | null;

export interface HeaderMenuProps {
  /** Opens the room-photo picker (owned by App) after confirmation. */
  onChangeRoom: () => void;
}

/**
 * Overflow menu hosting the three confirmed destructive actions (PER-05).
 * Every item routes through ConfirmDialog — a stray tap never destroys data.
 */
export function HeaderMenu({ onChangeRoom }: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const pick = (action: PendingAction) => {
    setOpen(false);
    setPending(action);
  };

  const confirm = () => {
    const s = useAppStore.getState();
    switch (pending) {
      case 'clear':
        if (s.activeRoomId) s.clearPlacements(s.activeRoomId);
        break;
      case 'change':
        onChangeRoom();
        break;
      case 'reset':
        s.resetStore();
        // Best-effort blob wipe; the store is already factory-fresh.
        void clearAllBlobs().catch(() => undefined);
        break;
    }
    setPending(null);
  };

  const ITEM = 'w-full text-left min-h-[44px] px-4 py-2 text-ink hover:bg-bg';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink"
      >
        <MoreVertical aria-hidden="true" size={20} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-lg py-2 z-40"
          style={{ fontSize: '14px', fontWeight: 700 }}
        >
          <button type="button" role="menuitem" className={ITEM} onClick={() => pick('clear')}>
            Clear placements
          </button>
          <button type="button" role="menuitem" className={ITEM} onClick={() => pick('change')}>
            Change room photo
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM + ' text-danger'}
            onClick={() => pick('reset')}
          >
            Reset everything
          </button>
        </div>
      )}
      <ConfirmDialog
        open={pending === 'clear'}
        title="Clear all placements?"
        body="Removes every placed item from this room. Your library is kept."
        confirmLabel="Clear placements"
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'change'}
        title="Change room photo?"
        body="Placements don't carry over to a new photo. Your library is kept."
        confirmLabel="Choose new photo"
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'reset'}
        title="Reset everything?"
        body="Deletes your room photo, library, and placements from this device."
        confirmLabel="Reset everything"
        danger
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
