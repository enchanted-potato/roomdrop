import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Undo2, X } from 'lucide-react';

import { deleteBlob, getBlob, setBlob, type BlobId } from '../../lib/idb';
import { libBlobId } from '../../lib/idb/blobIds';
import { useAppStore } from '../../store/useAppStore';
import { isBgJobActive } from './bgRemovalService';
import {
  applyAlpha,
  applyMask,
  autoRemoveCorners,
  extractAlpha,
  feather,
  floodRemoveAt,
  type RgbaImage,
} from './pixelOps';
import type { LibraryItem } from '../../store/types';

export interface ManualCutoutEditorProps {
  item: LibraryItem;
  onClose: () => void;
}

/** Longest working-canvas side; caps flood cost on phones (T-knz-01). */
const WORK_MAX = 800;
/** On-open + default flood tolerance (matches the PoC and bgRemoval feel). */
const DEFAULT_TOL = 36;
/** Undo history cap — bounds memory on large edits. */
const HISTORY_CAP = 24;

/**
 * Manual background-colour removal editor (QUICK-manual-cutout). A mobile-first
 * modal that loads the item's ORIGINAL blob, downscales it to a working
 * resolution, auto-clears the four corners, and lets the user tap-to-remove
 * contiguous colour regions. Save upscales the working alpha mask back onto the
 * full-resolution original so the stored cutout keeps the item's width/height.
 */
export function ManualCutoutEditor({ item, onClose }: ManualCutoutEditorProps) {
  const updateLibraryItem = useAppStore((s) => s.updateLibraryItem);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workRef = useRef<RgbaImage | null>(null);
  const pristineRef = useRef<Uint8ClampedArray | null>(null); // raw decode alpha+rgb
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const historyRef = useRef<Uint8ClampedArray[]>([]);

  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [tol, setTol] = useState(DEFAULT_TOL);
  const [historyLen, setHistoryLen] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Blit the working buffer onto the display canvas. */
  const paint = useCallback(() => {
    const work = workRef.current;
    const canvas = canvasRef.current;
    if (!work || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(work.data), work.width, work.height),
      0,
      0,
    );
  }, []);

  const pushHistory = useCallback(() => {
    const work = workRef.current;
    if (!work) return;
    historyRef.current.push(extractAlpha(work));
    if (historyRef.current.length > HISTORY_CAP) historyRef.current.shift();
    setHistoryLen(historyRef.current.length);
  }, []);

  // Load original → working buffer, auto-remove corners, first paint.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const blob = await getBlob(item.originalBlobId as BlobId);
        if (!blob) throw new Error('Original image is missing from storage');
        const img = new Image();
        objectUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Could not decode the original image'));
          img.src = objectUrl as string;
        });
        if (cancelled) return;

        const nW = item.width || img.naturalWidth;
        const nH = item.height || img.naturalHeight;
        naturalRef.current = { w: nW, h: nH };
        originalImgRef.current = img;

        const scale = Math.min(1, WORK_MAX / Math.max(nW, nH));
        const workW = Math.max(1, Math.round(nW * scale));
        const workH = Math.max(1, Math.round(nH * scale));

        const off = document.createElement('canvas');
        off.width = workW;
        off.height = workH;
        const octx = off.getContext('2d');
        if (!octx) throw new Error('Canvas 2D context unavailable');
        octx.drawImage(img, 0, 0, workW, workH);
        const imageData = octx.getImageData(0, 0, workW, workH);
        const work: RgbaImage = { data: imageData.data, width: workW, height: workH };
        workRef.current = work;
        pristineRef.current = new Uint8ClampedArray(work.data); // corner-free raw decode

        autoRemoveCorners(work, DEFAULT_TOL);
        if (cancelled) return;
        setDims({ w: workW, h: workH });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.originalBlobId, item.width, item.height]);

  // First paint once the canvas exists at the working dimensions.
  useEffect(() => {
    if (dims) paint();
  }, [dims, paint]);

  // Escape cancels (no writes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const work = workRef.current;
      const canvas = canvasRef.current;
      if (!work || !canvas || saving) return;
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * work.width);
      const y = Math.floor(((e.clientY - r.top) / r.height) * work.height);
      pushHistory();
      floodRemoveAt(work, x, y, tol);
      paint();
    },
    [paint, pushHistory, saving, tol],
  );

  const onUndo = useCallback(() => {
    const work = workRef.current;
    if (!work || historyRef.current.length === 0) return;
    const snapshot = historyRef.current.pop() as Uint8ClampedArray;
    applyAlpha(work, snapshot);
    setHistoryLen(historyRef.current.length);
    paint();
  }, [paint]);

  const onReset = useCallback(() => {
    const work = workRef.current;
    const pristine = pristineRef.current;
    if (!work || !pristine) return;
    work.data.set(pristine);
    historyRef.current = [];
    setHistoryLen(0);
    autoRemoveCorners(work, tol);
    paint();
  }, [paint, tol]);

  const onSave = useCallback(async () => {
    const work = workRef.current;
    const img = originalImgRef.current;
    if (!work || !img || saving) return;
    // Race guard: never overwrite a cutout while an ML job is in flight (T-knz-03).
    if (isBgJobActive(item.id)) return;
    setSaving(true);
    try {
      // 1. Soften the working-resolution edges.
      feather(work);

      const { w: nW, h: nH } = naturalRef.current;

      // 2. Upscale the working RGBA (alpha included) to natural size with
      //    smoothing, then read back its alpha as the full-res mask.
      const workCanvas = document.createElement('canvas');
      workCanvas.width = work.width;
      workCanvas.height = work.height;
      const wctx = workCanvas.getContext('2d');
      if (!wctx) throw new Error('Canvas 2D context unavailable');
      wctx.putImageData(
        new ImageData(new Uint8ClampedArray(work.data), work.width, work.height),
        0,
        0,
      );

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = nW;
      maskCanvas.height = nH;
      const mctx = maskCanvas.getContext('2d');
      if (!mctx) throw new Error('Canvas 2D context unavailable');
      mctx.imageSmoothingEnabled = true;
      mctx.drawImage(workCanvas, 0, 0, nW, nH);
      const upscaled = mctx.getImageData(0, 0, nW, nH);
      const mask = extractAlpha({ data: upscaled.data, width: nW, height: nH });

      // 3. Redraw the ORIGINAL at full resolution and apply the mask to its alpha.
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = nW;
      fullCanvas.height = nH;
      const fctx = fullCanvas.getContext('2d');
      if (!fctx) throw new Error('Canvas 2D context unavailable');
      fctx.drawImage(img, 0, 0, nW, nH);
      const full = fctx.getImageData(0, 0, nW, nH);
      applyMask({ data: full.data, width: nW, height: nH }, mask);
      fctx.putImageData(full, 0, 0);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        fullCanvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!pngBlob) throw new Error('Failed to encode the cutout PNG');

      // 4. Mirror the bgRemovalService save tail (T-knz-02): write new blob,
      //    update the store, then best-effort delete the previous cutout.
      const cutoutId = libBlobId(crypto.randomUUID());
      await setBlob(cutoutId, pngBlob);
      const prevCutout = useAppStore.getState().libraryItems[item.id]?.cutoutBlobId;
      updateLibraryItem(item.id, { cutoutBlobId: cutoutId, bgStatus: 'done', bgError: null });
      if (prevCutout) void deleteBlob(prevCutout as BlobId).catch(() => undefined);

      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Failed to save the cutout');
    }
  }, [item.id, onClose, saving, updateLibraryItem]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(58, 51, 44, 0.4)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manually remove background"
        className="bg-surface rounded-2xl shadow-lg p-4 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{ fontFamily: 'var(--font-display)', fontSize: '20px', lineHeight: 1.2 }}
          className="mb-1"
        >
          Remove background
        </h2>
        <p className="text-ink-mut mb-3" style={{ fontSize: '13px', lineHeight: 1.4 }}>
          Tap a colour to erase it. Corners are cleared automatically.
        </p>

        <div
          className="flex items-center justify-center rounded-xl bg-bg overflow-hidden"
          style={{
            minHeight: '160px',
            backgroundImage:
              'repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%)',
            backgroundSize: '16px 16px',
          }}
        >
          {error ? (
            <p className="text-danger p-6" style={{ fontSize: '14px' }}>
              {error}
            </p>
          ) : dims ? (
            <canvas
              ref={canvasRef}
              width={dims.w}
              height={dims.h}
              onPointerDown={onCanvasPointerDown}
              className="touch-none cursor-crosshair"
              style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
            />
          ) : (
            <p className="text-ink-mut p-6" style={{ fontSize: '14px' }}>
              Loading…
            </p>
          )}
        </div>

        <label className="block mt-4" style={{ fontSize: '13px', fontWeight: 700 }}>
          Tolerance: {tol}
          <input
            type="range"
            min={0}
            max={120}
            step={4}
            value={tol}
            onChange={(e) => setTol(Number(e.target.value))}
            className="w-full mt-1"
            aria-label="Removal tolerance"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onUndo}
            disabled={historyLen === 0 || saving}
            className="min-h-[44px] px-3 rounded-md border border-border text-ink font-bold flex items-center gap-1 disabled:opacity-40"
            style={{ fontSize: '14px' }}
          >
            <Undo2 aria-hidden="true" size={16} /> Undo
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="min-h-[44px] px-3 rounded-md border border-border text-ink font-bold flex items-center gap-1 disabled:opacity-40"
            style={{ fontSize: '14px' }}
          >
            <RotateCcw aria-hidden="true" size={16} /> Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-3 rounded-md border border-border text-ink font-bold flex items-center gap-1 disabled:opacity-40"
            style={{ fontSize: '14px' }}
          >
            <X aria-hidden="true" size={16} /> Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={!dims || saving || !!error}
            className="min-h-[44px] px-4 rounded-md bg-accent text-white font-bold flex items-center gap-1 disabled:opacity-40"
            style={{ fontSize: '14px' }}
          >
            <Check aria-hidden="true" size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
