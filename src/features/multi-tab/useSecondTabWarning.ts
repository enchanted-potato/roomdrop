import { useEffect, useState } from 'react';

const CHANNEL = 'roomdrop-tabs';

/**
 * Second-tab detection (PER-06, Pitfall M11). Every tab announces `hello` on
 * boot; any tab that hears a message (a newcomer's `hello`, or a `present`
 * reply to its own) knows another tab is open. We warn — we do not attempt
 * multi-tab merging.
 */
export function useSecondTabWarning(): { otherTabOpen: boolean; dismiss: () => void } {
  const [otherTabOpen, setOtherTabOpen] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent) => {
      if (e.data === 'hello') channel.postMessage('present');
      setOtherTabOpen(true);
    };
    channel.postMessage('hello');
    return () => channel.close();
  }, []);

  return { otherTabOpen, dismiss: () => setOtherTabOpen(false) };
}
