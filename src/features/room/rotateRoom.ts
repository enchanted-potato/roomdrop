import { deleteBlob, getBlob, setBlob, type BlobId } from '../../lib/idb';
import { roomBlobId } from '../../lib/idb/blobIds';
import { useAppStore } from '../../store/useAppStore';
import { showToast, type ToastSpec } from '../../store/toastStore';
import type { Placement, Room } from '../../store/types';

export const ROTATE_FAILED_TOAST: ToastSpec = {
  title: "Couldn't rotate the photo",
  body: 'Something went wrong. Try again, or upload the photo again.',
  variant: 'error',
};

/**
 * Map a placement into the coordinate space of its room rotated 90° CW.
 * A center point (x, y) in the old W×H image lands at (H − y, x) in the new
 * H×W image; the placement's own rotation advances by 90°. `flipX` commutes
 * with the whole-scene rotation, so it is untouched.
 */
export function rotatePlacement90CW(p: Placement, roomHeight: number): Placement {
  return {
    ...p,
    x: roomHeight - p.y,
    y: p.x,
    rotation: (p.rotation + 90) % 360,
  };
}

/**
 * Rotate the active room photo 90° clockwise.
 *
 * Re-encodes the stored blob onto a rotated OffscreenCanvas, writes it under a
 * NEW blobId (useBlobUrl keys on blobId, so reusing the old id would never
 * re-render), then atomically swaps the room record's dimensions and remaps
 * every placement into the new coordinate space. The old blob is deleted
 * best-effort last, so a failure at any earlier step leaves state untouched.
 */
export async function rotateActiveRoom(): Promise<void> {
  const s = useAppStore.getState();
  const room = s.activeRoomId ? (s.rooms[s.activeRoomId] ?? null) : null;
  if (!room) return;

  let rotated: { blob: Blob; width: number; height: number };
  try {
    const blob = await getBlob(room.blobId as BlobId);
    if (!blob) throw new Error('room blob missing');
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = new OffscreenCanvas(bitmap.height, bitmap.width);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(bitmap.height, 0);
      ctx.rotate(0.5 * Math.PI);
      ctx.drawImage(bitmap, 0, 0);
      const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      rotated = { blob: out, width: bitmap.height, height: bitmap.width };
    } finally {
      bitmap.close();
    }
  } catch {
    showToast(ROTATE_FAILED_TOAST);
    return;
  }

  const newBlobId = roomBlobId(crypto.randomUUID());
  try {
    await setBlob(newBlobId, rotated.blob);
  } catch {
    showToast(ROTATE_FAILED_TOAST);
    return;
  }

  const oldBlobId = room.blobId;
  const nextRoom: Room = {
    ...room,
    blobId: newBlobId,
    width: rotated.width,
    height: rotated.height,
  };
  useAppStore.setState((st) => ({
    rooms: { ...st.rooms, [room.id]: nextRoom },
    placements: {
      ...st.placements,
      [room.id]: (st.placements[room.id] ?? []).map((p) => rotatePlacement90CW(p, room.height)),
    },
    // The undo buffer holds pre-rotation coordinates; drop it rather than let
    // an undo restore an item at a now-meaningless position.
    deletedPlacement: st.deletedPlacement?.roomId === room.id ? null : st.deletedPlacement,
  }));

  try {
    await deleteBlob(oldBlobId as BlobId);
  } catch {
    /* best-effort — a stale blob never blocks the happy path */
  }
}
