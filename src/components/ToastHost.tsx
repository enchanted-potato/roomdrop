import { Toast } from './Toast';
import { dismissToast, useToast } from '../store/toastStore';

/**
 * Thin wrapper: renders the current toast (if any) with a dismiss handler.
 * Plan 04 (Wave 3) will mount <ToastHost /> inside <AppShell> in App.tsx.
 */
export function ToastHost() {
  const toast = useToast();
  if (!toast) return null;
  return <Toast toast={toast} onDismiss={dismissToast} />;
}
