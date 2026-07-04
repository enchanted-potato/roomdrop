import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';

import { probeWebGpu, useSettingsStore, type BgMode } from '../../store/settingsStore';
import { MODEL_SIZE_HINT } from './bgRemovalService';

/**
 * Header gear popover: Fast vs Quality background removal (BGR-02). The
 * pre-selection reflects the WebGPU probe until the user chooses explicitly.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [hasGpu, setHasGpu] = useState<boolean | null>(null);
  const bgMode = useSettingsStore((s) => s.bgMode);
  const setBgMode = useSettingsStore((s) => s.setBgMode);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void probeWebGpu().then(setHasGpu);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const effective: BgMode = bgMode ?? (hasGpu ? 'quality' : 'fast');

  const option = (mode: BgMode, label: string, hint: string) => (
    <label className="flex items-start gap-3 px-4 py-2 cursor-pointer hover:bg-bg">
      <input
        type="radio"
        name="bg-mode"
        checked={effective === mode}
        onChange={() => setBgMode(mode)}
        className="mt-1 accent-[#c17a52]"
      />
      <span>
        <span className="block" style={{ fontSize: '14px', fontWeight: 700 }}>
          {label}
        </span>
        <span className="block text-ink-mut" style={{ fontSize: '14px', lineHeight: 1.4 }}>
          {hint}
        </span>
      </span>
    </label>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink"
      >
        <Settings aria-hidden="true" size={20} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-72 bg-surface border border-border rounded-xl shadow-lg py-2 z-40"
        >
          <p className="px-4 py-1 text-ink-mut" style={{ fontSize: '12px', fontWeight: 700 }}>
            Background removal
          </p>
          {option('fast', 'Fast', `Smaller download (${MODEL_SIZE_HINT.fast}), quicker, rougher edges.`)}
          {option(
            'quality',
            hasGpu === false ? 'Quality (slow on this device)' : 'Quality',
            `Larger download (${MODEL_SIZE_HINT.quality}), slower, cleaner edges.`,
          )}
          <p className="px-4 pt-2 text-ink-mut" style={{ fontSize: '12px', lineHeight: 1.4 }}>
            Applies to new items. Use the retry button on an item to re-run it.
          </p>
        </div>
      )}
    </div>
  );
}
