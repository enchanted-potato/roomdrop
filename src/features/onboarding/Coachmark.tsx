import { useEffect, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { setNotice, useNotices } from '../../store/noticesStore';

const AUTO_DISMISS_MS = 8000;

/**
 * One-time tooltip after the user's first-ever placement (ONB-03).
 * Mounted inside the editor; watches placement count cross 0 → 1.
 */
export function Coachmark() {
  const { coachmarkShown } = useNotices();
  const hasPlacement = useAppStore((s) =>
    Object.values(s.placements).some((list) => list.length > 0),
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (coachmarkShown || !hasPlacement) return;
    // Defer past the commit so the effect never sets state synchronously.
    // Marking the notice re-runs this effect into the early return, so the
    // auto-dismiss lives in its own effect keyed on `visible`.
    const show = requestAnimationFrame(() => {
      setVisible(true);
      setNotice({ coachmarkShown: true });
    });
    return () => cancelAnimationFrame(show);
  }, [coachmarkShown, hasPlacement]);

  useEffect(() => {
    if (!visible) return;
    const hide = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(hide);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="absolute left-1/2 -translate-x-1/2 bottom-4 bg-ink text-white rounded-xl px-4 py-3 shadow-lg z-30 max-w-xs text-center"
      style={{ fontSize: '14px', lineHeight: 1.5 }}
      onClick={() => setVisible(false)}
    >
      Pinch to scale, twist to rotate. On a computer, drag the corner handles.
    </div>
  );
}
