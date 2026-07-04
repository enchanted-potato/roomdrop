import { useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';
import { composeRoomPng, deliverPng, exportFilename } from './exportRoom';

const EXPORT_FAILED_TOAST = {
  title: "Couldn't export the image",
  body: 'Something went wrong while composing the PNG. Try again.',
  variant: 'error' as const,
};

/** Header primary action: compose + share/download the designed room (EXP-01..03). */
export function ExportButton() {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    const s = useAppStore.getState();
    const room = s.activeRoomId ? s.rooms[s.activeRoomId] : undefined;
    if (!room || busy) return;
    setBusy(true);
    try {
      const png = await composeRoomPng(room, s.placements[room.id] ?? [], s.libraryItems);
      await deliverPng(png, exportFilename());
    } catch {
      showToast(EXPORT_FAILED_TOAST);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={busy}
      className="min-h-[44px] px-4 bg-accent text-white font-bold rounded-md disabled:opacity-60"
      style={{ fontSize: '14px' }}
    >
      {busy ? 'Exporting…' : 'Export'}
    </button>
  );
}
