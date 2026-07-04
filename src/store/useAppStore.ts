import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LibraryItem, PersistedState, Placement, Room } from './types';

/** Snapshot held for the one-level delete undo (EDT-08). Never persisted. */
export interface DeletedPlacement {
  roomId: string;
  placement: Placement;
  /** Original array index so undo restores the same z-position. */
  index: number;
}

interface AppActions {
  /**
   * Add or replace a room and mark it active. Existing rooms are preserved —
   * the multi-room schema (D-06) means "replace room" in the v1 UI is really
   * "add another and switch to it"; explicit deletion is Phase 2+.
   */
  setActiveRoom: (room: Room) => void;
  /**
   * Detach the active-room pointer without deleting the room record.
   * Used by Plan 04's D-09 self-healing path when the room's blob is missing
   * from IDB after a rehydrate.
   */
  clearActiveRoom: () => void;
  /** Add a library item to the top-level (non-room-scoped) library slice. */
  addLibraryItem: (item: LibraryItem) => void;
  /** Patch a library item in place (Phase 4 BG-removal status updates). */
  updateLibraryItem: (id: string, patch: Partial<LibraryItem>) => void;
  /**
   * Delete an item from the library strip (UPL-04). If placements still
   * reference it the record is kept with `inLibrary: false` so those
   * placements keep rendering; otherwise the record is dropped and the ids of
   * its now-orphaned blobs are returned for the caller to evict from IDB.
   */
  removeLibraryItem: (id: string) => { blobIdsToDelete: string[] };
  /** Append a placement at the top of the z-order (EDT-02). */
  addPlacement: (roomId: string, placement: Placement) => void;
  updatePlacement: (roomId: string, placementId: string, patch: Partial<Placement>) => void;
  /** Remove a placement, buffering it for one-level undo (EDT-08). */
  removePlacement: (roomId: string, placementId: string) => void;
  /** Restore the last removed placement at its original z-index. */
  undoRemovePlacement: () => void;
  /** Duplicate with a small offset, appended at the top (EDT-09). */
  duplicatePlacement: (roomId: string, placementId: string) => Placement | null;
  /** Move one step forward (+1) or backward (-1) in z-order (EDT-07). */
  movePlacementZ: (roomId: string, placementId: string, dir: 1 | -1) => void;
  /** Remove every placement for a room (PER-05 "Clear placements"). */
  clearPlacements: (roomId: string) => void;
  /** Drop placements keyed to a room that no longer exists (room replace). */
  dropRoomPlacements: (roomId: string) => void;
  /** Back to factory state (PER-05 "Reset everything"). IDB wipe is the caller's job. */
  resetStore: () => void;
}

interface TransientState {
  deletedPlacement: DeletedPlacement | null;
}

type AppState = PersistedState & TransientState & AppActions;

const initialState: PersistedState & TransientState = {
  schemaVersion: 1,
  rooms: {},
  activeRoomId: null,
  libraryItems: {},
  placements: {},
  deletedPlacement: null,
};

/** Offset applied to duplicates, in room-image pixels. */
const DUPLICATE_OFFSET = 48;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setActiveRoom: (room: Room) =>
        set((s) => ({
          rooms: { ...s.rooms, [room.id]: room },
          activeRoomId: room.id,
        })),
      clearActiveRoom: () => set({ activeRoomId: null }),
      addLibraryItem: (item: LibraryItem) =>
        set((s) => ({
          libraryItems: { ...s.libraryItems, [item.id]: item },
        })),
      updateLibraryItem: (id, patch) =>
        set((s) => {
          const existing = s.libraryItems[id];
          if (!existing) return s;
          return { libraryItems: { ...s.libraryItems, [id]: { ...existing, ...patch } } };
        }),
      removeLibraryItem: (id) => {
        const s = get();
        const item = s.libraryItems[id];
        if (!item) return { blobIdsToDelete: [] };
        const referenced =
          Object.values(s.placements).some((list) => list.some((p) => p.itemId === id)) ||
          s.deletedPlacement?.placement.itemId === id;
        if (referenced) {
          // Keep record + blobs alive for existing placements (criterion 5).
          set((st) => ({
            libraryItems: { ...st.libraryItems, [id]: { ...item, inLibrary: false } },
          }));
          return { blobIdsToDelete: [] };
        }
        set((st) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _dropped, ...rest } = st.libraryItems;
          return { libraryItems: rest };
        });
        const blobIdsToDelete = [item.originalBlobId];
        if (item.cutoutBlobId) blobIdsToDelete.push(item.cutoutBlobId);
        return { blobIdsToDelete };
      },
      addPlacement: (roomId, placement) =>
        set((s) => ({
          placements: {
            ...s.placements,
            [roomId]: [...(s.placements[roomId] ?? []), placement],
          },
        })),
      updatePlacement: (roomId, placementId, patch) =>
        set((s) => ({
          placements: {
            ...s.placements,
            [roomId]: (s.placements[roomId] ?? []).map((p) =>
              p.id === placementId ? { ...p, ...patch } : p,
            ),
          },
        })),
      removePlacement: (roomId, placementId) =>
        set((s) => {
          const list = s.placements[roomId] ?? [];
          const index = list.findIndex((p) => p.id === placementId);
          const placement = list[index];
          if (index === -1 || !placement) return s;
          return {
            placements: {
              ...s.placements,
              [roomId]: list.filter((p) => p.id !== placementId),
            },
            deletedPlacement: { roomId, placement, index },
          };
        }),
      undoRemovePlacement: () =>
        set((s) => {
          const buf = s.deletedPlacement;
          if (!buf) return s;
          const list = [...(s.placements[buf.roomId] ?? [])];
          list.splice(Math.min(buf.index, list.length), 0, buf.placement);
          return {
            placements: { ...s.placements, [buf.roomId]: list },
            deletedPlacement: null,
          };
        }),
      duplicatePlacement: (roomId, placementId) => {
        const list = get().placements[roomId] ?? [];
        const source = list.find((p) => p.id === placementId);
        if (!source) return null;
        const copy: Placement = {
          ...source,
          id: crypto.randomUUID(),
          x: source.x + DUPLICATE_OFFSET,
          y: source.y + DUPLICATE_OFFSET,
        };
        set((s) => ({
          placements: {
            ...s.placements,
            [roomId]: [...(s.placements[roomId] ?? []), copy],
          },
        }));
        return copy;
      },
      movePlacementZ: (roomId, placementId, dir) =>
        set((s) => {
          const list = [...(s.placements[roomId] ?? [])];
          const from = list.findIndex((p) => p.id === placementId);
          const to = from + dir;
          if (from === -1 || to < 0 || to >= list.length) return s;
          const [moved] = list.splice(from, 1);
          if (!moved) return s;
          list.splice(to, 0, moved);
          return { placements: { ...s.placements, [roomId]: list } };
        }),
      clearPlacements: (roomId) =>
        set((s) => ({
          placements: { ...s.placements, [roomId]: [] },
          deletedPlacement: s.deletedPlacement?.roomId === roomId ? null : s.deletedPlacement,
        })),
      dropRoomPlacements: (roomId) =>
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [roomId]: _dropped, ...rest } = s.placements;
          return {
            placements: rest,
            deletedPlacement: s.deletedPlacement?.roomId === roomId ? null : s.deletedPlacement,
          };
        }),
      resetStore: () => set({ ...initialState }),
    }),
    {
      name: 'roomdrop',
      version: 1,
      // Persist only the schema slice — never actions, never blobs (D-04),
      // never the transient undo buffer.
      partialize: (s): PersistedState => ({
        schemaVersion: s.schemaVersion,
        rooms: s.rooms,
        activeRoomId: s.activeRoomId,
        libraryItems: s.libraryItems,
        placements: s.placements,
      }),
      // Phase 1 payloads predate the Phase 2 LibraryItem fields; normalize
      // with additive defaults instead of bumping the schema version.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedState>;
        const libraryItems: Record<string, LibraryItem> = {};
        for (const [id, item] of Object.entries(p.libraryItems ?? {})) {
          // Runtime payloads from Phase 1 may lack the Phase 2 fields even
          // though the static type says otherwise.
          const partial = item as Partial<LibraryItem> & Pick<LibraryItem, 'id'>;
          libraryItems[id] = {
            originalBlobId: '',
            cutoutBlobId: null,
            width: 0,
            height: 0,
            inLibrary: true,
            bgStatus: 'none',
            bgError: null,
            createdAt: 0,
            ...partial,
          };
        }
        return { ...current, ...p, libraryItems };
      },
    },
  ),
);

// Re-export the shapes callers most often need alongside the store hook.
export type { Room, LibraryItem, Placement, PersistedState };
