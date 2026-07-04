import { useRef } from 'react';
import { Plus, RotateCcw, Square, X } from 'lucide-react';

import { useBlobUrl } from '../../lib/hooks/useBlobUrl';
import { deleteBlob, type BlobId } from '../../lib/idb';
import { useAppStore } from '../../store/useAppStore';
import { useBgProgress } from '../bg-removal/bgProgressStore';
import { cancelBgRemoval, rerunBgRemoval } from '../bg-removal/bgRemovalService';
import { uploadLibraryItems } from './useLibraryUpload';
import type { LibraryItem } from '../../store/types';

export interface LibraryPanelProps {
  /** Tap-to-place: drops the item at the room center (EDT-02, touch path). */
  onPlace: (item: LibraryItem) => void;
}

/**
 * Product library strip (UPL-02/04/05). Horizontally scrollable; sits below
 * the stage. Tapping a thumb places it; on desktop thumbs are also HTML5
 * drag sources targeted at the stage.
 */
export function LibraryPanel({ onPlace }: LibraryPanelProps) {
  const libraryItems = useAppStore((s) => s.libraryItems);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const items = Object.values(libraryItems)
    .filter((i) => i.inLibrary)
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <section aria-label="Your product library" className="shrink-0">
      <div className="flex gap-2 overflow-x-auto py-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-border-d bg-surface flex flex-col items-center justify-center text-ink-mut"
        >
          <Plus aria-hidden="true" size={20} />
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Add</span>
        </button>
        {items.map((item) => (
          <LibraryThumb key={item.id} item={item} onPlace={() => onPlace(item)} />
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) void uploadLibraryItems(Array.from(files));
          e.target.value = '';
        }}
      />
    </section>
  );
}

function LibraryThumb({ item, onPlace }: { item: LibraryItem; onPlace: () => void }) {
  const removeLibraryItem = useAppStore((s) => s.removeLibraryItem);
  const { url } = useBlobUrl(item.cutoutBlobId ?? item.originalBlobId);
  const progress = useBgProgress(item.id);
  const processing = item.bgStatus === 'processing';

  // Determinate percent only during the model download; compute stage is
  // honest-indeterminate (BGR-03).
  const badge =
    processing && progress?.stage === 'download' && progress.total > 0
      ? `Downloading ${Math.round((progress.loaded / progress.total) * 100)}%`
      : processing
        ? 'Removing…'
        : item.bgStatus === 'done'
          ? 'Cutout'
          : item.bgStatus === 'failed'
            ? 'Failed'
            : 'Original';

  const onDelete = () => {
    const { blobIdsToDelete } = removeLibraryItem(item.id);
    for (const id of blobIdsToDelete) {
      // Best-effort IDB eviction — a stale blob never blocks the UI.
      void deleteBlob(id as BlobId).catch(() => undefined);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Place item in room"
        onClick={onPlace}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-roomdrop-item', item.id);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        className="w-20 h-20 rounded-xl border border-border bg-surface overflow-hidden flex items-center justify-center"
      >
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
        ) : (
          <div className="w-full h-full bg-bg" aria-hidden="true" />
        )}
      </button>
      <span
        className="absolute bottom-1 left-1 rounded px-1 bg-surface/90 text-ink-mut border border-border"
        style={{ fontSize: '10px', fontWeight: 700, lineHeight: '14px' }}
      >
        {badge}
      </span>
      {(item.bgStatus === 'done' || item.bgStatus === 'failed') && (
        <button
          type="button"
          aria-label="Re-run background removal"
          onClick={() => rerunBgRemoval(item.id)}
          className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-surface border border-border text-ink-mut flex items-center justify-center shadow-sm"
        >
          <RotateCcw aria-hidden="true" size={12} />
        </button>
      )}
      {processing ? (
        <button
          type="button"
          aria-label="Cancel background removal"
          onClick={() => cancelBgRemoval(item.id)}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-surface border border-border text-danger flex items-center justify-center shadow-sm"
        >
          <Square aria-hidden="true" size={10} fill="currentColor" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Delete from library"
          onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-surface border border-border text-ink-mut flex items-center justify-center shadow-sm"
        >
          <X aria-hidden="true" size={12} />
        </button>
      )}
    </div>
  );
}
