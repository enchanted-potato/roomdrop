import { HeicNotSupportedError, pipeline } from '../../lib/image-pipeline';
import { setBlob } from '../../lib/idb';
import { libBlobId } from '../../lib/idb/blobIds';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';
import { GENERIC_UPLOAD_TOAST, HEIC_TOAST } from '../room/useRoomUpload';
import type { LibraryItem } from '../../store/types';

/**
 * Uploads one or more product images into the library (UPL-02). Each file
 * goes through the same ImagePipeline door as room photos (FND-04), then its
 * normalized blob lands in IDB under `lib:<uuid>` and the metadata record in
 * the store. Files are processed sequentially to bound peak memory on
 * mid-range phones (Pitfall C6).
 *
 * Per-file failures toast (HEIC vs generic) and skip the file — a bad file in
 * a multi-select never blocks the good ones.
 */
export async function uploadLibraryItems(files: Iterable<File>): Promise<void> {
  for (const file of files) {
    let normalized;
    try {
      normalized = await pipeline(file);
    } catch (err) {
      showToast(err instanceof HeicNotSupportedError ? HEIC_TOAST : GENERIC_UPLOAD_TOAST);
      continue;
    }

    const id = crypto.randomUUID();
    const blobId = libBlobId(id);
    try {
      await setBlob(blobId, normalized.blob);
    } catch {
      showToast(GENERIC_UPLOAD_TOAST);
      continue;
    }

    const item: LibraryItem = {
      id,
      originalBlobId: blobId,
      cutoutBlobId: null,
      width: normalized.width,
      height: normalized.height,
      inLibrary: true,
      bgStatus: 'none',
      bgError: null,
      createdAt: Date.now(),
    };
    useAppStore.getState().addLibraryItem(item);
  }
}

export function useLibraryUpload(): { uploadLibraryItems: typeof uploadLibraryItems } {
  return { uploadLibraryItems };
}
