import { ChevronDown, ChevronUp, Copy, FlipHorizontal2, Trash2 } from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../store/toastStore';

export interface SelectionToolbarProps {
  roomId: string;
  placementId: string;
  /** Called after delete so the editor can clear its selection. */
  onDeleted: () => void;
}

const BTN =
  'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-border bg-surface text-ink';

/**
 * Actions for the selected placement (EDT-07..10). Delete buffers a one-level
 * undo surfaced through an action toast (Pitfall m2).
 */
export function SelectionToolbar({ roomId, placementId, onDeleted }: SelectionToolbarProps) {
  const movePlacementZ = useAppStore((s) => s.movePlacementZ);
  const duplicatePlacement = useAppStore((s) => s.duplicatePlacement);
  const removePlacement = useAppStore((s) => s.removePlacement);
  const undoRemovePlacement = useAppStore((s) => s.undoRemovePlacement);
  const flipX = useAppStore(
    (s) => s.placements[roomId]?.find((p) => p.id === placementId)?.flipX ?? false,
  );
  const updatePlacement = useAppStore((s) => s.updatePlacement);

  const onDelete = () => {
    removePlacement(roomId, placementId);
    onDeleted();
    showToast({
      title: 'Item removed',
      body: '',
      variant: 'info',
      action: { label: 'Undo', onAction: undoRemovePlacement },
    });
  };

  return (
    <div
      role="toolbar"
      aria-label="Selected item actions"
      className="flex items-center justify-center gap-2"
    >
      <button
        type="button"
        aria-label="Bring forward"
        className={BTN}
        onClick={() => movePlacementZ(roomId, placementId, 1)}
      >
        <ChevronUp aria-hidden="true" size={20} />
      </button>
      <button
        type="button"
        aria-label="Send backward"
        className={BTN}
        onClick={() => movePlacementZ(roomId, placementId, -1)}
      >
        <ChevronDown aria-hidden="true" size={20} />
      </button>
      <button
        type="button"
        aria-label="Duplicate"
        className={BTN}
        onClick={() => duplicatePlacement(roomId, placementId)}
      >
        <Copy aria-hidden="true" size={20} />
      </button>
      <button
        type="button"
        aria-label="Flip horizontally"
        className={BTN}
        onClick={() => updatePlacement(roomId, placementId, { flipX: !flipX })}
      >
        <FlipHorizontal2 aria-hidden="true" size={20} />
      </button>
      <button
        type="button"
        aria-label="Delete"
        className={BTN + ' text-danger'}
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
