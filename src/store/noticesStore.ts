import { useSyncExternalStore } from 'react';

/**
 * One-time UI flags (FND-05 honesty notice, ONB-03 coachmark). Deliberately
 * outside the core `roomdrop` store: "Reset everything" wipes the data store
 * but should not re-trigger first-run notices.
 */
export interface Notices {
  honestyDismissed: boolean;
  coachmarkShown: boolean;
}

const KEY = 'roomdrop-notices';
const DEFAULTS: Notices = { honestyDismissed: false, coachmarkShown: false };

function read(): Notices {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Notices>) };
  } catch {
    return DEFAULTS;
  }
}

let current: Notices = read();
const listeners = new Set<() => void>();

export function setNotice(patch: Partial<Notices>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Quota/private-mode failure: the notice just re-appears next visit.
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useNotices(): Notices {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
