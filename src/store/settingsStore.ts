import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BgMode = 'fast' | 'quality';

interface SettingsState {
  /** null = user hasn't chosen; the WebGPU probe picks the default (BGR-02). */
  bgMode: BgMode | null;
  setBgMode: (mode: BgMode) => void;
}

/**
 * Tiny persisted settings slice, kept out of the core `roomdrop` store so the
 * v1 data schema stays untouched.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      bgMode: null,
      setBgMode: (bgMode) => set({ bgMode }),
    }),
    { name: 'roomdrop-settings', version: 1 },
  ),
);

let webgpuProbe: Promise<boolean> | null = null;

/**
 * WebGPU capability probe (Pitfall M6): `navigator.gpu` existing is not
 * enough — `requestAdapter()` must actually return an adapter. Result is
 * cached for the session.
 */
export function probeWebGpu(): Promise<boolean> {
  webgpuProbe ??= (async () => {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      if (!gpu) return false;
      return (await gpu.requestAdapter()) != null;
    } catch {
      return false;
    }
  })();
  return webgpuProbe;
}

/** Effective mode: explicit user choice, else WebGPU → quality, WASM → fast. */
export async function resolveBgMode(): Promise<BgMode> {
  const chosen = useSettingsStore.getState().bgMode;
  if (chosen) return chosen;
  return (await probeWebGpu()) ? 'quality' : 'fast';
}
