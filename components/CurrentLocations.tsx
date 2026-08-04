'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Box } from '@/components/Blueprint';
import { fmtDateTime } from '@/lib/format';

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

export type Fix = {
  device_id: string;
  driver: string | null;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  fixed_at: string;
};

/**
 * How old a fix may be before it is called stale.
 *
 * Reporting is opportunistic — it happens when a driver opens the app, not on
 * a schedule — so a phone mid-journey can legitimately go a couple of hours
 * without a word. A tighter threshold would mark almost every row stale and
 * the flag would stop meaning anything. Three hours is roughly "you have not
 * heard from this vehicle for a meaningful part of the working day".
 */
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/** "12 minutes ago" — the only number that matters on this page. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function CurrentLocations({ fixes }: { fixes: Fix[] }) {
  const [selected, setSelected] = useState(fixes[0]?.device_id ?? null);
  const shown = fixes.find((f) => f.device_id === selected) ?? fixes[0];

  if (fixes.length === 0) {
    return (
      <Box>
        <strong style={{ fontSize: 14 }}>Nothing has reported yet</strong>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
          A handset reports when its driver opens the app, inside 06:00–18:00.
          Nothing here yet means no phone has run a build with this feature, or
          none has been opened during the working day. Check{' '}
          <strong>Settings → Location reporting</strong> on the handset — it
          says whether it reported, or why it did not.
        </p>
      </Box>
    );
  }

  return (
    <>
      <Box style={{ padding: 0, marginBottom: 14 }}>
        <div className="scroll-x">
          <table style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Last report</th>
                <th style={{ textAlign: 'right' }}>Accuracy</th>
                <th style={{ textAlign: 'right' }}>Show</th>
              </tr>
            </thead>
            <tbody>
              {fixes.map((f) => {
                const stale = Date.now() - new Date(f.fixed_at).getTime() > STALE_AFTER_MS;
                return (
                  <tr
                    key={f.device_id}
                    style={
                      f.device_id === shown?.device_id
                        ? { background: 'var(--accent-100)' }
                        : undefined
                    }
                  >
                    <td>{f.driver ?? <span className="muted">no driver signed in</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {ago(f.fixed_at)}
                      {stale && (
                        <span style={{ color: 'var(--danger)', fontSize: 12 }}> · stale</span>
                      )}
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {fmtDateTime(f.fixed_at)}
                      </div>
                    </td>
                    <td className="metric" style={{ textAlign: 'right' }}>
                      {f.accuracy_m == null ? '—' : `±${Math.round(f.accuracy_m)} m`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn"
                        style={{ padding: '4px 10px', fontSize: 12.5 }}
                        onClick={() => setSelected(f.device_id)}
                      >
                        Map
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Box>

      {shown && (
        <>
          <Box style={{ padding: 0, marginBottom: 12 }}>
            {/* `key` forces a remount when the selection changes: Leaflet sets
                its centre on mount and ignores a later prop change. */}
            <StreetMap
              key={shown.device_id}
              track={[{ lat: shown.lat, lon: shown.lon }]}
              height={340}
            />
          </Box>
          <p className="muted" style={{ fontSize: 12.5 }}>
            {shown.driver ?? 'This handset'} at {shown.lat.toFixed(5)},{' '}
            {shown.lon.toFixed(5)} — {ago(shown.fixed_at)}.
          </p>
        </>
      )}
    </>
  );
}
