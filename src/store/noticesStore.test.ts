import { describe, expect, it } from 'vitest';

import { setNotice } from './noticesStore';

describe('noticesStore', () => {
  it('persists one-time flags to localStorage', () => {
    setNotice({ honestyDismissed: true });
    const raw = localStorage.getItem('roomdrop-notices');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ honestyDismissed: true, coachmarkShown: false });

    setNotice({ coachmarkShown: true });
    expect(JSON.parse(localStorage.getItem('roomdrop-notices')!)).toMatchObject({
      honestyDismissed: true,
      coachmarkShown: true,
    });
  });
});
