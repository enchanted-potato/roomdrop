import { get, set, del } from 'idb-keyval';

/**
 * Namespaced blob identifiers (D-05).
 * - `room:<uuid>` — uploaded room photo blobs
 * - `lib:<uuid>` — library item blobs (originals + cutouts in Phase 2/4)
 * - `skeleton:<key>` — Phase 1 walking-skeleton diagnostic records
 *
 * The template-literal type prevents callers from passing arbitrary strings
 * to the IDB helpers (T-01-01-02 mitigation).
 */
export type BlobId = `room:${string}` | `lib:${string}` | `skeleton:${string}`;

export function setBlob(id: BlobId, blob: Blob): Promise<void> {
  return set(id, blob);
}

export function getBlob(id: BlobId): Promise<Blob | undefined> {
  return get<Blob>(id);
}

export function deleteBlob(id: BlobId): Promise<void> {
  return del(id);
}

const SKELETON_KEY: BlobId = 'skeleton:hello';

/**
 * Walking-skeleton round-trip: proves the IDB plumbing works end-to-end.
 *
 * On first mount the record is absent → write `{ at: Date.now() }` and return
 * `{ at, firstMount: true }`. On subsequent mounts the stored timestamp is
 * read back and returned with `firstMount: false`. The value is serialized as
 * a JSON Blob so the same idb-keyval helpers (which are Blob-typed in this
 * wrapper) round-trip without special-casing.
 */
export async function skeletonPing(): Promise<{ at: number; firstMount: boolean }> {
  const existing = await getBlob(SKELETON_KEY);
  if (existing) {
    try {
      const text = await existing.text();
      const parsed = JSON.parse(text) as { at: number };
      if (typeof parsed.at === 'number') {
        return { at: parsed.at, firstMount: false };
      }
    } catch {
      // Corrupt record — fall through and overwrite below.
    }
  }
  const at = Date.now();
  const blob = new Blob([JSON.stringify({ at })], { type: 'application/json' });
  await setBlob(SKELETON_KEY, blob);
  return { at, firstMount: true };
}
