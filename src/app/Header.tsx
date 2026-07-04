import { ExportButton } from '../features/export/ExportButton';
import { HeaderMenu } from './HeaderMenu';

export interface HeaderProps {
  hasActiveRoom: boolean;
  onChangeRoom?: () => void;
}

/**
 * Top header bar: wordmark + tagline (desktop) on the left; when a room is
 * loaded, the Export primary action and the destructive-actions overflow menu
 * on the right. "Change room photo" moved into the menu with confirmation in
 * Phase 3 (PER-05). Copy is locked per UI-SPEC §"Copywriting Contract".
 */
export function Header({ hasActiveRoom, onChangeRoom }: HeaderProps) {
  return (
    <header className="bg-surface border-b border-border px-4 md:px-8 py-3 flex items-center justify-between">
      <div className="flex items-baseline">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            lineHeight: 1.1,
          }}
        >
          RoomDrop
        </span>
        <span className="hidden md:inline ml-3 text-ink-mut" style={{ fontSize: '14px' }}>
          Preview a piece before you buy it
        </span>
      </div>
      {hasActiveRoom && (
        <div className="flex items-center gap-1">
          <ExportButton />
          <HeaderMenu onChangeRoom={onChangeRoom ?? (() => undefined)} />
        </div>
      )}
    </header>
  );
}
