import { useState } from 'react';
import { RotateCw } from 'lucide-react';

import { rotateActiveRoom } from './rotateRoom';

/**
 * Overlay control to rotate the room photo 90° CW per tap. Lets users fix a
 * photo that arrived in the wrong orientation without re-uploading.
 */
export function RotateRoomButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      aria-label="Rotate photo 90 degrees clockwise"
      disabled={busy}
      className="absolute top-2 right-2 z-20 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-border bg-surface text-ink shadow-md disabled:opacity-50"
      onClick={() => {
        setBusy(true);
        void rotateActiveRoom().finally(() => setBusy(false));
      }}
    >
      <RotateCw aria-hidden="true" size={20} />
    </button>
  );
}
