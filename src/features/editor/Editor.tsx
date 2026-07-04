import { useState, type ReactElement } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { LibraryPanel } from '../library/LibraryPanel';
import { EditorStage } from './EditorStage';
import { SelectionToolbar } from './SelectionToolbar';
import { makePlacement } from './placement';
import type { LibraryItem } from '../../store/types';

/**
 * Editor layout for the room-present state: stage on top, selection toolbar
 * (when an item is selected), library strip at the bottom. Selection is view
 * state — never persisted.
 */
export function Editor(): ReactElement | null {
  const room = useAppStore((s) => (s.activeRoomId ? (s.rooms[s.activeRoomId] ?? null) : null));
  const placements = useAppStore((s) =>
    s.activeRoomId ? (s.placements[s.activeRoomId] ?? EMPTY) : EMPTY,
  );
  const addPlacement = useAppStore((s) => s.addPlacement);
  const libraryItems = useAppStore((s) => s.libraryItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!room) return null;

  const place = (item: LibraryItem, x?: number, y?: number) => {
    const placement = makePlacement(item, room, x, y);
    addPlacement(room.id, placement);
    setSelectedId(placement.id);
  };

  const selectionValid = selectedId !== null && placements.some((p) => p.id === selectedId);

  return (
    <main className="flex-1 min-h-0 flex flex-col gap-3 px-4 py-3 md:px-8">
      <EditorStage
        room={room}
        placements={placements}
        selectedId={selectionValid ? selectedId : null}
        onSelect={setSelectedId}
        onDropItem={(itemId, x, y) => {
          const item = libraryItems[itemId];
          if (item) place(item, x, y);
        }}
      />
      {selectionValid && (
        <SelectionToolbar
          roomId={room.id}
          placementId={selectedId}
          onDeleted={() => setSelectedId(null)}
        />
      )}
      <LibraryPanel onPlace={place} />
    </main>
  );
}

const EMPTY: never[] = [];
