import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setBlob, getBlob } from '../../lib/idb';
import { useAppStore } from '../../store/useAppStore';
import { cancelBgRemoval, enqueueBgRemoval } from './bgRemovalService';
import type { LibraryItem } from '../../store/types';

// Controllable stand-in for the imgly worker call.
let resolveRemove: ((blob: Blob) => void) | null = null;
let rejectRemove: ((err: Error) => void) | null = null;
vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn(
    () =>
      new Promise<Blob>((resolve, reject) => {
        resolveRemove = resolve;
        rejectRemove = reject;
      }),
  ),
}));

function seedItem(id: string): LibraryItem {
  const item: LibraryItem = {
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
  useAppStore.getState().addLibraryItem(item);
  return item;
}

async function flush(): Promise<void> {
  // Macrotask turns: fake-indexeddb resolves on timers, not microtasks.
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  useAppStore.setState({ libraryItems: {}, placements: {}, deletedPlacement: null });
  resolveRemove = null;
  rejectRemove = null;
});

describe('bgRemovalService', () => {
  it('marks processing, then done with a stored cutout blob (BGR-01)', async () => {
    const item = seedItem(crypto.randomUUID());
    await setBlob(item.originalBlobId as `lib:${string}`, new Blob(['x'], { type: 'image/jpeg' }));

    enqueueBgRemoval(item.id);
    expect(useAppStore.getState().libraryItems[item.id]!.bgStatus).toBe('processing');

    await flush();
    expect(resolveRemove).not.toBeNull();
    resolveRemove!(new Blob(['cutout'], { type: 'image/png' }));
    await flush();

    const updated = useAppStore.getState().libraryItems[item.id]!;
    expect(updated.bgStatus).toBe('done');
    expect(updated.cutoutBlobId).not.toBeNull();
    const stored = await getBlob(updated.cutoutBlobId as `lib:${string}`);
    expect(stored).toBeDefined();
  });

  it('cancel discards a late result and returns status to none (BGR-04)', async () => {
    const item = seedItem(crypto.randomUUID());
    await setBlob(item.originalBlobId as `lib:${string}`, new Blob(['x'], { type: 'image/jpeg' }));

    enqueueBgRemoval(item.id);
    await flush();
    cancelBgRemoval(item.id);
    expect(useAppStore.getState().libraryItems[item.id]!.bgStatus).toBe('none');

    // Inference "finishes" after the cancel — result must be discarded.
    resolveRemove?.(new Blob(['late'], { type: 'image/png' }));
    await flush();
    const updated = useAppStore.getState().libraryItems[item.id]!;
    expect(updated.bgStatus).toBe('none');
    expect(updated.cutoutBlobId).toBeNull();
  });

  it('failure keeps the original usable and records the reason (BGR-05)', async () => {
    const item = seedItem(crypto.randomUUID());
    await setBlob(item.originalBlobId as `lib:${string}`, new Blob(['x'], { type: 'image/jpeg' }));

    enqueueBgRemoval(item.id);
    await flush();
    rejectRemove!(new Error('WebGPU adapter lost'));
    await flush();

    const updated = useAppStore.getState().libraryItems[item.id]!;
    expect(updated.bgStatus).toBe('failed');
    expect(updated.bgError).toBe('WebGPU adapter lost');
    expect(updated.cutoutBlobId).toBeNull();
    expect(updated.originalBlobId).toBe(item.originalBlobId);
  });
});
