export interface HeaderProps {
  hasActiveRoom: boolean;
  onChangeRoom?: () => void;
}

/**
 * Top header bar: wordmark + tagline (desktop) on the left, conditional
 * "Change room photo" button on the right when a room is loaded.
 * Copy is locked per UI-SPEC §"Copywriting Contract".
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
        <span
          className="hidden md:inline ml-3 text-ink-mut"
          style={{ fontSize: '14px' }}
        >
          Preview a piece before you buy it
        </span>
      </div>
      {hasActiveRoom && (
        <button
          type="button"
          onClick={onChangeRoom}
          className="min-h-[44px] px-4 text-ink font-bold"
          style={{ fontSize: '14px' }}
        >
          Change room photo
        </button>
      )}
    </header>
  );
}
