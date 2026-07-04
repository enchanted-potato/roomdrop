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

/** Background-removal lifecycle for a library item (Phase 4 populates). */
export type BgStatus = 'none' | 'processing' | 'done' | 'failed';

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
  /** Natural pixel size of the original upload (post-pipeline). */
  width: number;
  height: number;
  /**
   * False once the user deletes the item from the library strip. The record
   * (and its IDB blobs) survive while any placement still references the item
   * — Phase 2 success criterion 5. Hard deletion happens only when the item
   * is both out of the library and unreferenced.
   */
  inLibrary: boolean;
  /** Phase 4 BG-removal status; 'none' until then. */
  bgStatus: BgStatus;
  /** Human-readable reason for the last BG-removal failure (BGR-05). */
  bgError: string | null;
  createdAt: number;
}

/**
 * One placed item on a room. Coordinates live in the ROOM IMAGE's natural
 * pixel space (not screen space) — `x`/`y` is the item's center point. The
 * stage applies one display scale factor when rendering; Phase 3 export draws
 * these values directly onto a native-resolution canvas.
 */
export interface Placement {
  id: string;
  /** LibraryItem id — rendered via `cutoutBlobId ?? originalBlobId` (EDT-11). */
  itemId: string;
  x: number;
  y: number;
  /** Uniform scale relative to the item's natural size (aspect preserved). */
  scale: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Rendered as negative x-scale around the center (EDT-10). */
  flipX: boolean;
}

/**
 * The exact shape written to localStorage by Zustand's `persist` middleware
 * (D-06). Multi-room support is baked in from v1 even though the Phase 1 UI
 * only exposes a single active room — that's the seam PER-04 depends on.
 * Z-order within a room = array position (React keys stay the stable ids).
 */
export interface PersistedState {
  schemaVersion: 1;
  /** Multi-room schema — D-06. v1 UI only exposes one room but the shape supports many. */
  rooms: Record<string, Room>;
  activeRoomId: string | null;
  libraryItems: Record<string, LibraryItem>;
  placements: Record<string, Placement[]>;
}
