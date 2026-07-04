import artUrl from '../../assets/samples/art.png?url';
import cushionUrl from '../../assets/samples/cushion.png?url';
import plantUrl from '../../assets/samples/plant.png?url';
import roomUrl from '../../assets/samples/room.jpg?url';
import tableUrl from '../../assets/samples/table.png?url';
import { setBlob } from '../../lib/idb';
import { libBlobId } from '../../lib/idb/blobIds';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';
import { uploadRoom, GENERIC_UPLOAD_TOAST } from '../room/useRoomUpload';
import type { LibraryItem } from '../../store/types';

/** Fixed ids make the sample load idempotent (and reset-safe). */
const SAMPLES: ReadonlyArray<{ id: string; url: string }> = [
  { id: 'sample-cushion', url: cushionUrl },
  { id: 'sample-art', url: artUrl },
  { id: 'sample-plant', url: plantUrl },
  { id: 'sample-table', url: tableUrl },
];

/**
 * "Try with a sample room" (ONB-02): bundled demo room + 4 pre-cutout
 * products, so a visitor can try the drag/place experience with zero uploads
 * and zero model download. Product PNGs already have alpha — they are stored
 * as BOTH original and cutout (`bgStatus: 'done'`), so BG removal never runs
 * on them.
 */
export async function loadSampleRoom(): Promise<void> {
  try {
    const roomBlob = await (await fetch(roomUrl)).blob();
    await uploadRoom(new File([roomBlob], 'sample-room.jpg', { type: 'image/jpeg' }));

    const state = useAppStore.getState();
    for (const sample of SAMPLES) {
      const existing = state.libraryItems[sample.id];
      if (existing?.inLibrary) continue; // idempotent re-tap

      // Stored directly (not via ImagePipeline): the pipeline re-encodes to
      // JPEG, which would destroy the pre-cutout alpha channel. The bundled
      // assets are already normalized (≤2048 px, no EXIF).
      const raw = await (await fetch(sample.url)).blob();
      const { width, height } = await measurePng(raw);
      const blobId = libBlobId(sample.id);
      await setBlob(blobId, raw);
      const item: LibraryItem = {
        id: sample.id,
        originalBlobId: blobId,
        cutoutBlobId: blobId,
        width,
        height,
        inLibrary: true,
        bgStatus: 'done',
        bgError: null,
        createdAt: Date.now(),
      };
      useAppStore.getState().addLibraryItem(item);
    }
  } catch {
    showToast(GENERIC_UPLOAD_TOAST);
  }
}

async function measurePng(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
