import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LibraryItem, PersistedState, Placement, Room } from './types';

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
}

type AppState = PersistedState & AppActions;

const initialState: PersistedState = {
  schemaVersion: 1,
  rooms: {},
  activeRoomId: null,
  libraryItems: {},
  placements: {},
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'roomdrop',
      version: 1,
      // Persist only the schema slice — never actions, never blobs (D-04).
      partialize: (s): PersistedState => ({
        schemaVersion: s.schemaVersion,
        rooms: s.rooms,
        activeRoomId: s.activeRoomId,
        libraryItems: s.libraryItems,
        placements: s.placements,
      }),
    },
  ),
);

// Re-export the shapes callers most often need alongside the store hook.
export type { Room, LibraryItem, Placement, PersistedState };
