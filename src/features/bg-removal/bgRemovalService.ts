import { deleteBlob, getBlob, setBlob, type BlobId } from '../../lib/idb';
import { libBlobId } from '../../lib/idb/blobIds';
import { resolveBgMode, probeWebGpu } from '../../store/settingsStore';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';
import { clearBgProgress, setBgProgress } from './bgProgressStore';

/** Fast/Quality → imgly model mapping (STACK.md, BGR-02). */
const MODEL_BY_MODE = { fast: 'isnet_quint8', quality: 'isnet_fp16' } as const;
export const MODEL_SIZE_HINT = { fast: '~44 MB', quality: '~80 MB' } as const;

const FAILED_TOAST_BODY = 'The original photo is still usable — tap the retry button to try again.';

interface Job {
  itemId: string;
  controller: AbortController;
  cancelled: boolean;
}

// Sequential queue: one inference in flight bounds peak memory on phones
// (Pitfall C6). `jobs` tracks queued + running so cancel works at any stage.
const jobs = new Map<string, Job>();
let queueTail: Promise<void> = Promise.resolve();
let sizeHintShown = false;

export function isBgJobActive(itemId: string): boolean {
  return jobs.has(itemId);
}

/**
 * Queue background removal for a library item (BGR-01). Safe to call for an
 * item already in flight (no-op). Fire-and-forget: all outcomes land in the
 * store, never thrown.
 */
export function enqueueBgRemoval(itemId: string): void {
  if (jobs.has(itemId)) return;
  const job: Job = { itemId, controller: new AbortController(), cancelled: false };
  jobs.set(itemId, job);
  useAppStore.getState().updateLibraryItem(itemId, { bgStatus: 'processing', bgError: null });
  queueTail = queueTail.then(() => runJob(job));
}

/**
 * Cancel a queued or running job (BGR-04). Aborts the model download (the
 * long pole); a compute already in flight finishes in its worker but the
 * result is discarded and status returns to 'none' — no state corruption.
 */
export function cancelBgRemoval(itemId: string): void {
  const job = jobs.get(itemId);
  if (!job) return;
  job.cancelled = true;
  job.controller.abort();
  jobs.delete(itemId);
  clearBgProgress(itemId);
  useAppStore.getState().updateLibraryItem(itemId, { bgStatus: 'none', bgError: null });
}

/** Re-run after a mode switch or failure (BGR-06). */
export function rerunBgRemoval(itemId: string): void {
  enqueueBgRemoval(itemId);
}

async function runJob(job: Job): Promise<void> {
  const { itemId } = job;
  if (job.cancelled) return;
  const item = useAppStore.getState().libraryItems[itemId];
  if (!item) {
    jobs.delete(itemId);
    return;
  }

  try {
    const original = await getBlob(item.originalBlobId as BlobId);
    if (!original) throw new Error('Original image is missing from storage');

    const [mode, hasGpu] = await Promise.all([resolveBgMode(), probeWebGpu()]);
    // Dynamic import keeps ~1 MB of ONNX runtime glue out of the main bundle
    // until the first job actually needs it.
    const { removeBackground } = await import('@imgly/background-removal');
    if (job.cancelled) return;

    const cutout = await removeBackground(original, {
      model: MODEL_BY_MODE[mode],
      device: hasGpu ? 'gpu' : 'cpu',
      output: { format: 'image/png' },
      fetchArgs: { signal: job.controller.signal },
      progress: (key: string, current: number, total: number) => {
        if (job.cancelled) return;
        if (key.startsWith('fetch:')) {
          // Honest first-run size hint, shown only when a real download starts
          // (Pitfall M4).
          if (!sizeHintShown && total > 1_000_000) {
            sizeHintShown = true;
            showToast({
              title: 'First-time setup',
              body: `Downloading the background removal model (${MODEL_SIZE_HINT[mode]}) — Wi-Fi recommended. This happens once.`,
              variant: 'info',
            });
          }
          setBgProgress(itemId, { stage: 'download', loaded: current, total });
        } else {
          setBgProgress(itemId, { stage: 'compute', loaded: current, total });
        }
      },
    });
    if (job.cancelled) return;

    const cutoutId = libBlobId(crypto.randomUUID());
    await setBlob(cutoutId, cutout);
    if (job.cancelled) {
      void deleteBlob(cutoutId).catch(() => undefined);
      return;
    }

    const prevCutout = useAppStore.getState().libraryItems[itemId]?.cutoutBlobId;
    useAppStore.getState().updateLibraryItem(itemId, {
      cutoutBlobId: cutoutId,
      bgStatus: 'done',
      bgError: null,
    });
    if (prevCutout) void deleteBlob(prevCutout as BlobId).catch(() => undefined);
  } catch (err) {
    if (job.cancelled) return;
    const reason =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'The model download was interrupted'
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    useAppStore.getState().updateLibraryItem(itemId, { bgStatus: 'failed', bgError: reason });
    showToast({
      title: "Couldn't remove the background",
      body: `${reason}. ${FAILED_TOAST_BODY}`,
      variant: 'error',
    });
  } finally {
    if (!job.cancelled) {
      jobs.delete(itemId);
      clearBgProgress(itemId);
    }
  }
}
