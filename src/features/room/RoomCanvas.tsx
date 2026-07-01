import { useEffect, useState, type ReactElement } from 'react';

import { getBlob } from '../../lib/idb';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';
import { SkeletonRoom } from './SkeletonRoom';
import { GENERIC_UPLOAD_TOAST } from './useRoomUpload';
import type { BlobId } from '../../lib/idb';

/**
 * D-09 self-healing toast copy — locked in CONTEXT.md D-09 and appended to
 * UI-SPEC toast catalog by Plan 04.
 */
const SELF_HEAL_TOAST = {
  title: "We couldn't reload your last photo",
  body: 'Upload again to continue.',
  variant: 'error' as const,
};

/**
 * RoomCanvas — the "loaded state" for the stage.
 *
 * Boot sequence (D-08):
 *   1. Zustand rehydrates synchronously → activeRoomId present.
 *   2. This component mounts → renders <SkeletonRoom /> immediately.
 *   3. useEffect fires → getBlob(room.blobId) → URL.createObjectURL.
 *   4. <img> mounts with opacity 0 → transitions to opacity 1 over 150ms.
 *
 * Self-healing (D-09): if getBlob returns undefined the app clears
 * activeRoomId + evicts the stale room record + emits the locked toast.
 *
 * Pitfall 4 (React 19 StrictMode double-invocation): every effect owns its
 * own `revoked` flag and revokes any URL it created on cleanup, so
 * dev-only double mounts do not leak object URLs.
 */
export function RoomCanvas(): ReactElement | null {
  const activeRoomId = useAppStore((s) => s.activeRoomId);
  const room = useAppStore((s) => (s.activeRoomId ? (s.rooms[s.activeRoomId] ?? null) : null));

  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load blob when room changes. Keyed on room?.blobId so a Change-room replace
  // (same component instance, new blob) still re-runs the effect.
  const blobId = room?.blobId ?? null;
  useEffect(() => {
    if (!blobId) return;

    let revoked = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const blob = await getBlob(blobId as BlobId);
        if (revoked) return;
        if (!blob) {
          // D-09 self-heal: stale localStorage points at a missing IDB blob.
          showToast(SELF_HEAL_TOAST);
          useAppStore.setState((s) => {
            if (!s.activeRoomId) return s;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [s.activeRoomId]: _evicted, ...rest } = s.rooms;
            return { activeRoomId: null, rooms: rest };
          });
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setUrl(createdUrl);
      } catch {
        showToast(GENERIC_UPLOAD_TOAST);
      }
    })();

    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      // Reset local view state so a subsequent load starts from opacity 0.
      setUrl(null);
      setLoaded(false);
    };
  }, [blobId]);

  // Once the URL is present, flip `loaded` on the next animation frame so the
  // initial opacity-0 render commits before the transition fires.
  useEffect(() => {
    if (!url) return;
    const rafId = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(rafId);
  }, [url]);

  if (activeRoomId === null) return null;

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-lg">
      {!loaded && <SkeletonRoom />}
      {url && (
        <img
          src={url}
          alt=""
          className="w-full h-auto block"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 150ms ease-out',
            // While loading, avoid the img taking layout space above the skeleton.
            position: loaded ? 'static' : 'absolute',
            inset: loaded ? 'auto' : 0,
          }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
