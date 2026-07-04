import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from './useAppStore';
import type { LibraryItem, Placement } from './types';

function makeItem(id: string): LibraryItem {
  return {
    id,
    originalBlobId: `lib:${id}`,
    cutoutBlobId: null,
    width: 400,
    height: 300,
    inLibrary: true,
    bgStatus: 'none',
    bgError: null,
    createdAt: 1,
  };
}

function makePlacement(id: string, itemId: string): Placement {
  return { id, itemId, x: 100, y: 100, scale: 1, rotation: 0, flipX: false };
}

const ROOM = 'r1';

beforeEach(() => {
  useAppStore.setState({
    rooms: {},
    activeRoomId: null,
    libraryItems: {},
    placements: {},
    deletedPlacement: null,
  });
});

describe('placement actions', () => {
  it('adds placements at the top of the z-order', () => {
    const s = useAppStore.getState();
    s.addPlacement(ROOM, makePlacement('p1', 'i1'));
    s.addPlacement(ROOM, makePlacement('p2', 'i1'));
    expect(useAppStore.getState().placements[ROOM]!.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('updates a placement in place', () => {
    const s = useAppStore.getState();
    s.addPlacement(ROOM, makePlacement('p1', 'i1'));
    s.updatePlacement(ROOM, 'p1', { rotation: 45, flipX: true });
    const p = useAppStore.getState().placements[ROOM]![0]!;
    expect(p.rotation).toBe(45);
    expect(p.flipX).toBe(true);
  });

  it('remove + undo restores the placement at its original z-index', () => {
    const s = useAppStore.getState();
    s.addPlacement(ROOM, makePlacement('p1', 'i1'));
    s.addPlacement(ROOM, makePlacement('p2', 'i1'));
    s.addPlacement(ROOM, makePlacement('p3', 'i1'));
    s.removePlacement(ROOM, 'p2');
    expect(useAppStore.getState().placements[ROOM]!.map((p) => p.id)).toEqual(['p1', 'p3']);
    useAppStore.getState().undoRemovePlacement();
    expect(useAppStore.getState().placements[ROOM]!.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(useAppStore.getState().deletedPlacement).toBeNull();
  });

  it('duplicate appends an offset copy with a new id', () => {
    const s = useAppStore.getState();
    s.addPlacement(ROOM, makePlacement('p1', 'i1'));
    const copy = s.duplicatePlacement(ROOM, 'p1');
    expect(copy).not.toBeNull();
    const list = useAppStore.getState().placements[ROOM]!;
    expect(list).toHaveLength(2);
    expect(list[1]!.id).not.toBe('p1');
    expect(list[1]!.x).toBe(148);
  });

  it('movePlacementZ reorders and clamps at the ends', () => {
    const s = useAppStore.getState();
    s.addPlacement(ROOM, makePlacement('p1', 'i1'));
    s.addPlacement(ROOM, makePlacement('p2', 'i1'));
    s.movePlacementZ(ROOM, 'p1', 1);
    expect(useAppStore.getState().placements[ROOM]!.map((p) => p.id)).toEqual(['p2', 'p1']);
    s.movePlacementZ(ROOM, 'p1', 1); // already at top — no-op
    expect(useAppStore.getState().placements[ROOM]!.map((p) => p.id)).toEqual(['p2', 'p1']);
  });
});

describe('removeLibraryItem', () => {
  it('hard-deletes an unreferenced item and returns its blob ids', () => {
    useAppStore.getState().addLibraryItem(makeItem('i1'));
    const { blobIdsToDelete } = useAppStore.getState().removeLibraryItem('i1');
    expect(blobIdsToDelete).toEqual(['lib:i1']);
    expect(useAppStore.getState().libraryItems['i1']).toBeUndefined();
  });

  it('keeps a referenced item alive with inLibrary=false (criterion 5)', () => {
    useAppStore.getState().addLibraryItem(makeItem('i1'));
    useAppStore.getState().addPlacement(ROOM, makePlacement('p1', 'i1'));
    const { blobIdsToDelete } = useAppStore.getState().removeLibraryItem('i1');
    expect(blobIdsToDelete).toEqual([]);
    expect(useAppStore.getState().libraryItems['i1']!.inLibrary).toBe(false);
    // Placement still renders through the retained record.
    expect(useAppStore.getState().placements[ROOM]![0]!.itemId).toBe('i1');
  });
});

describe('persistence boundary', () => {
  it('never persists the transient undo buffer (C1 guard)', () => {
    useAppStore.getState().addPlacement(ROOM, makePlacement('p1', 'i1'));
    useAppStore.getState().removePlacement(ROOM, 'p1');
    const raw = localStorage.getItem('roomdrop');
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('deletedPlacement');
  });
});
