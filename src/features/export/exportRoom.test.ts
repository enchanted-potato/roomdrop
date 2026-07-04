import { describe, expect, it } from 'vitest';

import { exportFilename } from './exportRoom';

describe('exportFilename', () => {
  it('formats as roomdrop-YYYYMMDD-<shortId>.png (EXP-03)', () => {
    const name = exportFilename(new Date(2026, 6, 4));
    expect(name).toMatch(/^roomdrop-20260704-[0-9a-f-]{6}\.png$/);
  });

  it('generates distinct short ids', () => {
    expect(exportFilename()).not.toBe(exportFilename());
  });
});
