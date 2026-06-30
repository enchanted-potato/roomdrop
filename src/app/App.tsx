import { useEffect, useRef, useState } from 'react';
import { Footer } from '../components/Footer';
import { skeletonPing } from '../lib/idb';

export function App() {
  const [ping, setPing] = useState<{ at: number; firstMount: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const didPingRef = useRef(false);

  useEffect(() => {
    // Pitfall 4: guard against React 19 StrictMode double-invocation in dev.
    if (didPingRef.current) return;
    didPingRef.current = true;
    void skeletonPing().then(setPing);
  }, []);

  const onChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <main style={{ flex: 1, padding: '1rem' }}>
        <h1>RoomDrop</h1>
        <p>
          {ping
            ? `Last skeleton ping: ${new Date(ping.at).toISOString()}${
                ping.firstMount ? ' (first mount)' : ''
              }`
            : 'Loading…'}
        </p>
        <button type="button" onClick={onChoosePhoto}>
          Choose photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={() => {
            /* no-op in Plan 01 — file processing lands in Plan 04 */
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
