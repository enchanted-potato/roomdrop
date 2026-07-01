import { useSyncExternalStore } from 'react';

export type ToastVariant = 'error';

export interface ToastSpec {
  title: string;
  body: string;
  variant: ToastVariant;
}

// Toasts are transient UI. Kept OUT of the persisted useAppStore (Plan 03)
// so a stale error can't rehydrate on page refresh.
let current: ToastSpec | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const AUTO_DISMISS_MS = 8000;

function emit() {
  for (const l of listeners) l();
}

function clearTimer() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

export function showToast(spec: ToastSpec): void {
  // T-01-02-06 mitigation: cancel any prior timer before scheduling a new one
  // so a preempted toast doesn't dismiss the next one early.
  clearTimer();
  current = spec;
  timerId = setTimeout(() => {
    current = null;
    timerId = null;
    emit();
  }, AUTO_DISMISS_MS);
  emit();
}

export function dismissToast(): void {
  clearTimer();
  current = null;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): ToastSpec | null {
  return current;
}

export function useToast(): ToastSpec | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
