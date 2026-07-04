import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';

import { useBlobUrl, useHtmlImage } from '../../lib/hooks/useBlobUrl';
import type { LibraryItem, Placement } from '../../store/types';

export interface PlacedItemProps {
  placement: Placement;
  item: LibraryItem;
  onSelect: () => void;
  onCommit: (patch: Partial<Placement>) => void;
  /** Registers the Konva node so the stage can attach the Transformer. */
  registerNode: (id: string, node: Konva.Image | null) => void;
}

/**
 * One placed product on the stage. Renders via `cutoutBlobId ?? originalBlobId`
 * (EDT-11) so cutouts from Phase 4 swap in without touching placements.
 *
 * The Konva node is the live source of truth DURING an interaction; the store
 * is only written on drag/transform end so localStorage isn't hammered at
 * 60 fps (PER-01 still holds — every meaningful change ends in a commit).
 */
export function PlacedItem({ placement, item, onSelect, onCommit, registerNode }: PlacedItemProps) {
  const { url } = useBlobUrl(item.cutoutBlobId ?? item.originalBlobId);
  const image = useHtmlImage(url);

  return (
    <KonvaImage
      ref={(node) => {
        registerNode(placement.id, node);
      }}
      image={image ?? undefined}
      width={item.width}
      height={item.height}
      offsetX={item.width / 2}
      offsetY={item.height / 2}
      x={placement.x}
      y={placement.y}
      scaleX={placement.scale * (placement.flipX ? -1 : 1)}
      scaleY={placement.scale}
      rotation={placement.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={(e) => onCommit({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        onCommit({
          x: node.x(),
          y: node.y(),
          scale: Math.abs(node.scaleX()),
          rotation: node.rotation(),
        });
      }}
    />
  );
}
