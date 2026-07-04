import type { LibraryItem, Placement, Room } from '../../store/types';

/** New placements land at ~35% of the room's width (CONTEXT decision). */
const INITIAL_WIDTH_FRACTION = 0.35;

/**
 * Build a placement for a library item, centered at (x, y) in room-image
 * natural pixel space. Defaults to the room center.
 */
export function makePlacement(
  item: LibraryItem,
  room: Room,
  x = room.width / 2,
  y = room.height / 2,
): Placement {
  const targetWidth = room.width * INITIAL_WIDTH_FRACTION;
  return {
    id: crypto.randomUUID(),
    itemId: item.id,
    x,
    y,
    scale: item.width > 0 ? targetWidth / item.width : 1,
    rotation: 0,
    flipX: false,
  };
}
