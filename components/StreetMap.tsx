'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import type { TrackPoint } from '@/lib/types';

/**
 * The recorded track on real OpenStreetMap tiles — the dashboard's counterpart
 * to the phone's "Streets" map style, drawn from the same stored track.
 *
 * Leaflet touches `window` on import, so this module is never imported
 * directly: `TripMap` pulls it in through `next/dynamic` with `ssr: false`.
 *
 * Start and end are `CircleMarker`s rather than Leaflet's default pin. The
 * default icon loads its PNGs by a relative URL that bundlers rewrite, which is
 * the classic "markers are invisible" bug; a circle is pure SVG and has no
 * assets to lose.
 */
export default function StreetMap({
  track,
  height,
}: {
  track: TrackPoint[];
  height: number;
}) {
  const positions: LatLngExpression[] = track.map((p) => [p.lat, p.lon]);

  const lats = track.map((p) => p.lat);
  const lons = track.map((p) => p.lon);
  const bounds: LatLngBoundsExpression = [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];

  // A single fix has no extent to fit — Leaflet would zoom to infinity.
  const degenerate =
    track.length < 2 ||
    (Math.max(...lats) - Math.min(...lats) < 1e-9 &&
      Math.max(...lons) - Math.min(...lons) < 1e-9);

  const start = positions[0];
  const end = positions[positions.length - 1];

  return (
    <MapContainer
      {...(degenerate
        ? { center: start, zoom: 16 }
        : { bounds, boundsOptions: { padding: [28, 28] as [number, number] } })}
      scrollWheelZoom
      style={{ height, width: '100%', background: 'var(--surface)' }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {!degenerate && (
        <Polyline positions={positions} pathOptions={{ color: '#5980a6', weight: 5 }} />
      )}

      <CircleMarker
        center={start}
        radius={7}
        pathOptions={{ color: '#5d5d60', fillColor: '#f2f2f3', fillOpacity: 1, weight: 3 }}
      >
        <Tooltip>{degenerate ? 'Only recorded fix' : 'Start'}</Tooltip>
      </CircleMarker>

      {!degenerate && (
        <CircleMarker
          center={end}
          radius={7}
          pathOptions={{ color: '#5980a6', fillColor: '#5980a6', fillOpacity: 1, weight: 3 }}
        >
          <Tooltip>End</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
