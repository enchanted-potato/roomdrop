import { REPO_URL } from '../app/config';

export function Footer() {
  return (
    <footer
      className="bg-surface border-t border-border text-ink-mut text-center py-4 px-4"
      style={{ fontSize: '16px' }}
    >
      RoomDrop is{' '}
      <a href={REPO_URL} target="_blank" rel="noopener">
        <strong>Open source</strong>
      </a>{' '}
      under AGPL-3.0
    </footer>
  );
}
