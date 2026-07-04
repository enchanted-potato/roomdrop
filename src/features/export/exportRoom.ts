import { getBlob, type BlobId } from '../../lib/idb';
import type { LibraryItem, Placement, Room } from '../../store/types';

/**
 * Compose the designed room into a PNG at the room photo's NATIVE resolution
 * (EXP-01). Placements are stored in room-image pixel space (Phase 2
 * decision), so drawing is 1:1 — no display-scale conversion (Pitfall M9).
 *
 * All inputs are same-origin blobs from IDB, so the canvas is never tainted
 * (Pitfall C5).
 */
export async function composeRoomPng(
  room: Room,
  placements: Placement[],
  items: Record<string, LibraryItem>,
): Promise<Blob> {
  const roomBlob = await getBlob(room.blobId as BlobId);
  if (!roomBlob) throw new Error('Room photo missing from storage');

  const canvas = document.createElement('canvas');
  canvas.width = room.width;
  canvas.height = room.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const roomBitmap = await createImageBitmap(roomBlob);
  try {
    ctx.drawImage(roomBitmap, 0, 0, room.width, room.height);
  } finally {
    roomBitmap.close();
  }

  // Draw bottom-to-top; array order IS z-order.
  for (const p of placements) {
    const item = items[p.itemId];
    if (!item) continue;
    const blob = await getBlob((item.cutoutBlobId ?? item.originalBlobId) as BlobId);
    if (!blob) continue; // missing blob: skip rather than fail the export
    const bitmap = await createImageBitmap(blob);
    try {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(p.scale * (p.flipX ? -1 : 1), p.scale);
      ctx.drawImage(bitmap, -item.width / 2, -item.height / 2, item.width, item.height);
      ctx.restore();
    } finally {
      bitmap.close();
    }
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
      'image/png',
    );
  });
}

/** `roomdrop-YYYYMMDD-<shortId>.png` (EXP-03, Pitfall M10). */
export function exportFilename(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const shortId = crypto.randomUUID().slice(0, 6);
  return `roomdrop-${y}${m}${d}-${shortId}.png`;
}

/**
 * Deliver the PNG: native share sheet where files are shareable (EXP-02 —
 * saves to Photos / messengers on mobile), otherwise a named download
 * (EXP-03). A user-cancelled share is not an error.
 */
export async function deliverPng(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Share failed for another reason — fall through to download.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the click a tick before revoking (Safari needs the URL alive
    // through the download trigger).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
