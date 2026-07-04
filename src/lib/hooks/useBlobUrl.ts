import { useEffect, useState } from 'react';

import { getBlob, type BlobId } from '../idb';

/**
 * Loads a blob from IndexedDB and exposes it as an object URL, revoking on
 * unmount / id change (Pitfall m7 — centralized URL lifecycle; Pitfall M12 —
 * URLs are per-tab handles, so they are always minted on demand, never
 * persisted).
 *
 * `missing` becomes true when IDB has no blob for the id — callers decide the
 * self-heal policy (D-09).
 */
export function useBlobUrl(blobId: string | null): { url: string | null; missing: boolean } {
  const [state, setState] = useState<{ url: string | null; missing: boolean }>({
    url: null,
    missing: false,
  });

  useEffect(() => {
    // When blobId is null the previous effect's cleanup has already reset
    // state (and the initial state is already empty) — no sync setState here.
    if (!blobId) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      const blob = await getBlob(blobId as BlobId).catch(() => undefined);
      if (cancelled) return;
      if (!blob) {
        setState({ url: null, missing: true });
        return;
      }
      createdUrl = URL.createObjectURL(blob);
      setState({ url: createdUrl, missing: false });
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setState({ url: null, missing: false });
    };
  }, [blobId]);

  return state;
}

/**
 * Loads an HTMLImageElement from an object URL for use as a Konva `image`
 * prop. Kept separate from useBlobUrl so the URL lifecycle stays in one hook.
 */
export function useHtmlImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    // Cleanup of the prior effect already nulled the image — see above.
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = url;
    return () => {
      cancelled = true;
      setImage(null);
    };
  }, [url]);

  return image;
}
