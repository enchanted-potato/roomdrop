import { useEffect, useRef } from 'react';

import { AppShell } from './AppShell';
import { Header } from './Header';
import { Footer } from '../components/Footer';
import { ToastHost } from '../components/ToastHost';
import { RoomDropzone } from '../features/room/RoomDropzone';
import { Editor } from '../features/editor/Editor';
import { useRoomUpload } from '../features/room/useRoomUpload';
import { useAppStore } from '../store/useAppStore';

export function App() {
  const activeRoomId = useAppStore((s) => s.activeRoomId);
  const { uploadRoom } = useRoomUpload();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Boot-time best-effort persistence grant (RESEARCH Pitfall 5 + Open Q #3):
  // dampens iOS 7-day ITP eviction. Rejections are swallowed — no UI surface.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {
      /* ignore */
    });
  }, []);

  const openPicker = () => inputRef.current?.click();

  return (
    <AppShell>
      <Header hasActiveRoom={activeRoomId !== null} onChangeRoom={openPicker} />
      {activeRoomId === null ? (
        <main className="flex-1 flex items-center justify-center px-4 py-6 md:py-12">
          <RoomDropzone onFile={uploadRoom} />
        </main>
      ) : (
        <Editor />
      )}
      <Footer />
      {/*
        Header-owned hidden input for the "Change room photo" flow. Kept here
        (not in Header) so it persists while RoomDropzone is unmounted. Reset
        value on every change so picking the same file twice still fires onChange.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadRoom(file);
          e.currentTarget.value = '';
        }}
      />
      <ToastHost />
    </AppShell>
  );
}
