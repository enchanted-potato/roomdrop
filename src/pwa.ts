import { registerSW } from 'virtual:pwa-register';

import { showToast } from './store/toastStore';

/**
 * Service-worker registration with an explicit update prompt (Pitfall M14):
 * a redeploy surfaces "New version available" instead of silently swapping
 * the shell. `?nosw=1` is the emergency bypass (Pitfall m4) — it skips
 * registration AND unregisters any existing worker.
 */
export function setupPwa(): void {
  if (new URLSearchParams(window.location.search).has('nosw')) {
    void navigator.serviceWorker?.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
    return;
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      showToast({
        title: 'New version available',
        body: 'Refresh to get the latest RoomDrop.',
        variant: 'info',
        action: { label: 'Refresh', onAction: () => void updateSW(true) },
      });
    },
  });
}
