import { HeicNotSupportedError, pipeline } from '../../lib/image-pipeline';
import { deleteBlob, setBlob } from '../../lib/idb';
import { roomBlobId } from '../../lib/idb/blobIds';
import { useAppStore } from '../../store/useAppStore';
import { showToast, type ToastSpec } from '../../store/toastStore';
import type { Room } from '../../store/types';

/**
 * Locked UI-SPEC copy (§"Copywriting Contract"). Exported for parity with any
 * future surface that needs to emit the same toast (single source of truth).
 */
export const HEIC_TOAST: ToastSpec = {
  title: "That photo format isn't supported yet",
  body: 'iPhone HEIC photos can\'t be opened in the browser. In Photos, tap Share → "Save to Files" as JPEG, then upload that.',
  variant: 'error',
};

export const GENERIC_UPLOAD_TOAST: ToastSpec = {
  title: "Couldn't open that photo",
  body: 'The file may be corrupted or too large. Try a different photo.',
  variant: 'error',
};

/**
 * Orchestrates a room upload end-to-end:
 *   pipeline(file)  →  setBlob(room:<uuid>, blob)  →  setActiveRoom(room)  →
 *   deleteBlob(priorRoom.blobId) + evict prior room record (memory hygiene).
 *
 * Never mutates `libraryItems` — that absence is what satisfies UPL-03 by
 * construction (library survives a room replace).
 *
 * Errors:
 * - `HeicNotSupportedError` → emit `HEIC_TOAST`, no state mutation.
 * - Any other pipeline / setBlob failure → emit `GENERIC_UPLOAD_TOAST`, no
 *   state mutation.
 */
export async function uploadRoom(file: File): Promise<void> {
  const prior = useAppStore.getState();
  const priorRoom = prior.activeRoomId ? (prior.rooms[prior.activeRoomId] ?? null) : null;

  let normalized;
  try {
    normalized = await pipeline(file);
  } catch (err) {
    if (err instanceof HeicNotSupportedError) {
      showToast(HEIC_TOAST);
    } else {
      showToast(GENERIC_UPLOAD_TOAST);
    }
    return;
  }

  const id = crypto.randomUUID();
  const blobId = roomBlobId(id);

  try {
    await setBlob(blobId, normalized.blob);
  } catch {
    // IDB QuotaExceededError, transient failure, etc. Collapse to the generic
    // toast per UI-SPEC — no separate copy for quota in Phase 1.
    showToast(GENERIC_UPLOAD_TOAST);
    return;
  }

  const room: Room = {
    id,
    blobId,
    width: normalized.width,
    height: normalized.height,
    createdAt: Date.now(),
  };

  useAppStore.getState().setActiveRoom(room);

  if (priorRoom && priorRoom.id !== room.id) {
    // Best-effort cleanup: swallow IDB delete errors so a stale blob does not
    // block the happy path. The multi-room schema (D-06) allows keeping the
    // old room around, but Phase 1 UI is single-room, so we evict eagerly to
    // avoid quota growth. Phase 2 + v2 EDT2-01 revisit this policy.
    try {
      await deleteBlob(priorRoom.blobId as Parameters<typeof deleteBlob>[0]);
    } catch {
      /* ignore */
    }
    useAppStore.setState((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [priorRoom.id]: _evicted, ...rest } = s.rooms;
      return { rooms: rest };
    });
    // Placements don't carry over to a new photo (Phase 3 decision) — drop
    // the evicted room's list so it can't orphan library refcounts.
    useAppStore.getState().dropRoomPlacements(priorRoom.id);
  }
}

/**
 * Hook wrapper. Phase 1 is stateless; kept as a hook so Phase 2 can add a
 * `useState<'idle' | 'processing' | 'error'>` machine without changing the
 * call site.
 */
export function useRoomUpload(): { uploadRoom: (file: File) => Promise<void> } {
  return { uploadRoom };
}
