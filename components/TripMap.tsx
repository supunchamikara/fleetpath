'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { RouteMap } from './RouteMap';
import type { TrackPoint } from '@/lib/types';

/**
 * The journey's route, in the two styles the phone offers: real OpenStreetMap
 * streets, or the offline drafting grid.
 *
 * Streets is the default — a route means more against real roads. The grid
 * stays because it is the one view that renders with no network at all, which
 * is also what you want when tiles are blocked or slow.
 *
 * `ssr: false` is required, not stylistic: Leaflet reads `window` at import
 * time, so pulling it into a server render throws. That is why the import lives
 * here, in a client component, rather than in the page.
 */
const StreetMap = dynamic(() => import('./StreetMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 340, background: 'var(--surface)', display: 'grid', placeItems: 'center' }}
      className="muted"
    >
      Loading map…
    </div>
  ),
});

type Style = 'streets' | 'grid';

export function TripMap({ track, height = 340 }: { track: TrackPoint[]; height?: number }) {
  const [style, setStyle] = useState<Style>('streets');

  if (!track || track.length === 0) {
    // Nothing to place on a map; the grid already says so in the house style.
    return <RouteMap track={track} height={height} />;
  }

  return (
    <div style={{ position: 'relative' }}>
      {style === 'streets' ? (
        <StreetMap track={track} height={height} />
      ) : (
        <RouteMap track={track} height={height} />
      )}

      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          // Leaflet panes sit at z-index 400; the toggle has to clear them.
          zIndex: 500,
          display: 'flex',
          border: '1px solid var(--divider)',
        }}
      >
        {(['streets', 'grid'] as Style[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyle(s)}
            style={{
              padding: '5px 11px',
              fontSize: 12,
              cursor: 'pointer',
              border: 'none',
              background: style === s ? 'var(--accent)' : 'var(--bg)',
              color: style === s ? 'var(--bg)' : 'var(--text)',
            }}
          >
            {s === 'streets' ? 'Streets' : 'Grid'}
          </button>
        ))}
      </div>
    </div>
  );
}
