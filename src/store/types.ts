/**
 * Persisted domain types (D-06, D-07).
 *
 * Every value in this file MUST round-trip through JSON — no `Date`, `Map`,
 * `Set`, or `Blob`. Timestamps are stored as epoch milliseconds (via
 * `Date.now()`). Blobs live in IndexedDB and are referenced here only by
 * their namespaced `BlobId`.
 */

export interface Room {
  id: string;
  /** IndexedDB key, formatted as `room:<uuid>` (see lib/idb/blobIds.ts). */
  blobId: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  /** IndexedDB key for the untouched user upload (`lib:<uuid>`). */
  originalBlobId: string;
  /**
   * IndexedDB key for the background-removed cutout, or `null` while the
   * cutout is still being computed / not yet run. Consumers rendering the
   * library thumb use `cutoutBlobId ?? originalBlobId` so the fallback
   * naturally kicks in before Phase 4 lands (D-05 seam).
   */
  cutoutBlobId: string | null;
  createdAt: number;
}

/**
 * Phase 2 will populate this with `x`, `y`, `scale`, `rotation`, `itemId`, etc.
 * Kept empty in Phase 1 to preserve the persisted-state schema seam without
 * committing to placement-specific fields prematurely.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Placement {}

/**
 * The exact shape written to localStorage by Zustand's `persist` middleware
 * (D-06). Multi-room support is baked in from v1 even though the Phase 1 UI
 * only exposes a single active room — that's the seam PER-04 depends on.
 */
export interface PersistedState {
  schemaVersion: 1;
  /** Multi-room schema — D-06. v1 UI only exposes one room but the shape supports many. */
  rooms: Record<string, Room>;
  activeRoomId: string | null;
  libraryItems: Record<string, LibraryItem>;
  placements: Record<string, Placement[]>;
}
