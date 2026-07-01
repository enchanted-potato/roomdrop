import { useEffect, useRef, useState } from 'react';
import { AppShell } from './AppShell';
import { Header } from './Header';
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

  // Plan 04 will replace this <main> body with <RoomDropzone> / <RoomCanvas>
  // and pass a real `hasActiveRoom` to <Header>. Plan 02 keeps the Plan 01
  // skeleton-ping demo intact so the IDB round-trip remains verifiable.
  return (
    <AppShell>
      <Header hasActiveRoom={false} />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-ink-mut" style={{ fontSize: '16px' }}>
            {ping
              ? `Last skeleton ping: ${new Date(ping.at).toISOString()}${
                  ping.firstMount ? ' (first mount)' : ''
                }`
              : 'Loading…'}
          </p>
          <button
            type="button"
            onClick={onChoosePhoto}
            className="mt-4 min-h-[44px] px-6 bg-accent text-white font-bold rounded-md"
            style={{ fontSize: '14px' }}
          >
            Choose photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={() => {
              /* no-op in Plan 02 — file processing lands in Plan 04 */
            }}
          />
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
