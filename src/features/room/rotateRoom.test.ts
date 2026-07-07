import { describe, expect, it } from 'vitest';

import { rotatePlacement90CW } from './rotateRoom';
import type { Placement } from '../../store/types';

function placement(overrides: Partial<Placement> = {}): Placement {
  return {
    id: 'p1',
    itemId: 'i1',
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    flipX: false,
    ...overrides,
  };
}

describe('rotatePlacement90CW', () => {
  // Room used throughout: 400 wide × 300 tall, rotating to 300 × 400.
  const ROOM_H = 300;

  it('maps a center point (x, y) to (H − y, x)', () => {
    const p = rotatePlacement90CW(placement({ x: 100, y: 50 }), ROOM_H);
    expect(p.x).toBe(250);
    expect(p.y).toBe(100);
  });

  it('keeps the room center fixed under rotation', () => {
    const p = rotatePlacement90CW(placement({ x: 200, y: 150 }), ROOM_H);
    // New room is 300 × 400; its center is (150, 200).
    expect(p.x).toBe(150);
    expect(p.y).toBe(200);
  });

  it('advances the placement rotation by 90° with wraparound', () => {
    expect(rotatePlacement90CW(placement({ rotation: 0 }), ROOM_H).rotation).toBe(90);
    expect(rotatePlacement90CW(placement({ rotation: 300 }), ROOM_H).rotation).toBe(30);
  });

  it('preserves scale, flipX, and identity fields', () => {
    const p = rotatePlacement90CW(placement({ scale: 0.5, flipX: true }), ROOM_H);
    expect(p.scale).toBe(0.5);
    expect(p.flipX).toBe(true);
    expect(p.id).toBe('p1');
    expect(p.itemId).toBe('i1');
  });

  it('returns to the original position after four rotations', () => {
    // 400 × 300 → 300 × 400 → 400 × 300 → 300 × 400 → 400 × 300.
    const heights = [300, 400, 300, 400];
    let p = placement({ x: 120, y: 80, rotation: 45 });
    for (const h of heights) p = rotatePlacement90CW(p, h);
    expect(p.x).toBe(120);
    expect(p.y).toBe(80);
    expect(p.rotation).toBe(45);
  });
});
