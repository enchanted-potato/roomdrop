import type { ReactNode } from 'react';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * Top-level layout wrapper. The `.app-shell` class is defined in src/styles/index.css
 * and owns safe-area padding + 100svh height + column flex. Header/main/Footer are
 * placed as direct children by App.tsx.
 */
export function AppShell({ children }: AppShellProps) {
  return <div className="app-shell">{children}</div>;
}
