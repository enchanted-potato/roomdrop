import { REPO_URL } from '../app/config';

export function Footer() {
  return (
    <footer
      style={{
        padding: '1rem',
        textAlign: 'center',
        fontSize: '0.875rem',
        color: '#666',
      }}
    >
      RoomDrop is{' '}
      <a href={REPO_URL} target="_blank" rel="noopener">
        <strong>Open source</strong>
      </a>{' '}
      under AGPL-3.0
    </footer>
  );
}
