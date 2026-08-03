'use client';

import type { TrackPoint } from '@/lib/types';

/**
 * The recorded track on the app's drafting grid, drawn as plain SVG.
 *
 * Deliberately dependency-free: no tile layer means no map library, no API
 * key and no SSR/window juggling, and it matches the phone's blueprint view.
 * The projection is the same equirectangular one the app uses, so a route
 * looks identical in both places.
 */
export function RouteMap({
  track,
  height = 320,
}: {
  track: TrackPoint[];
  height?: number;
}) {
  const W = 1000;
  const H = Math.round((height / 320) * 420);
  const PAD = 40;

  if (!track || track.length === 0) {
    return (
      <div
        style={{
          height,
          background: 'var(--surface)',
          display: 'grid',
          placeItems: 'center',
        }}
        className="muted"
      >
        No track recorded
      </div>
    );
  }

  const kx = Math.cos((track[0].lat * Math.PI) / 180);
  const xs = track.map((p) => p.lon * kx);
  const ys = track.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale =
    spanX < 1e-9 && spanY < 1e-9
      ? 1
      : Math.min(
          spanX < 1e-9 ? Infinity : (W - PAD * 2) / spanX,
          spanY < 1e-9 ? Infinity : (H - PAD * 2) / spanY,
        );

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pts = track.map((p, i) => ({
    x: W / 2 + (xs[i] - cx) * scale,
    y: H / 2 + (ys[i] - cy) * scale,
  }));

  // One fix, or a vehicle that never left the spot, has no line to draw: the
  // path degenerates to a bare moveto and SVG renders nothing at all. Say so,
  // because an empty grid is indistinguishable from a map that failed to load.
  const hasRoute = pts.length > 1 && (spanX > 1e-9 || spanY > 1e-9);

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height, display: 'block', background: 'var(--surface)' }}
    >
      <defs>
        <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M42 0H0V42" fill="none" stroke="var(--accent)" strokeOpacity="0.2" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {hasRoute && (
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <circle cx={first.x} cy={first.y} r="7" fill="var(--bg)" stroke="#5d5d60" strokeWidth="3" />
      {hasRoute && (
        <rect x={last.x - 5.5} y={last.y - 5.5} width="11" height="11" fill="var(--accent)" />
      )}
      {!hasRoute && (
        <>
          <circle
            cx={first.x}
            cy={first.y}
            r="20"
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.45"
          />
          <text
            x={W / 2}
            y={first.y + 46}
            textAnchor="middle"
            fontSize="15"
            fill="var(--accent)"
          >
            {track.length === 1
              ? 'Single GPS fix — no route to draw'
              : `${track.length} fixes, all at the same spot — no route to draw`}
          </text>
        </>
      )}
      <text x={W - 12} y="22" textAnchor="end" fontSize="11" letterSpacing="1" fill="var(--accent)">
        ROUTE FIELD
      </text>
    </svg>
  );
}
