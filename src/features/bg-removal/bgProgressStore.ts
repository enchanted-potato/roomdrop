import { useSyncExternalStore } from 'react';

export interface BgProgress {
  /** 'download' has determinate loaded/total; 'compute' is indeterminate. */
  stage: 'download' | 'compute';
  loaded: number;
  total: number;
}

// Transient per-item progress. Module store (same pattern as toastStore) —
// never persisted, cleared when a job settles.
let progressMap: ReadonlyMap<string, BgProgress> = new Map();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setBgProgress(itemId: string, progress: BgProgress): void {
  const next = new Map(progressMap);
  next.set(itemId, progress);
  progressMap = next;
  emit();
}

export function clearBgProgress(itemId: string): void {
  if (!progressMap.has(itemId)) return;
  const next = new Map(progressMap);
  next.delete(itemId);
  progressMap = next;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useBgProgress(itemId: string): BgProgress | null {
  return useSyncExternalStore(
    subscribe,
    () => progressMap.get(itemId) ?? null,
    () => null,
  );
}
