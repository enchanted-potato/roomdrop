export interface SkeletonRoomProps {
  ariaLabel?: string;
}

/**
 * Hydration placeholder shown while the room blob resolves from IDB.
 * 16:9 --surface rectangle with a 1.5s opacity pulse (keyframes in index.css).
 */
export function SkeletonRoom({ ariaLabel = 'Loading your room photo' }: SkeletonRoomProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className="bg-surface rounded-2xl w-full"
      style={{
        aspectRatio: '16 / 9',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}
