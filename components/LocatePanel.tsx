'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { Box } from '@/components/Blueprint';
import { describeError } from '@/lib/errors';
import { fmtDateTime } from '@/lib/format';

const StreetMap = dynamic(() => import('./StreetMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 320, background: 'var(--surface)', display: 'grid', placeItems: 'center' }}
      className="muted"
    >
      Loading map…
    </div>
  ),
});

type Row = {
  id: string;
  status: 'pending' | 'answered' | 'failed';
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
  fixed_at: string | null;
  error: string | null;
  expires_at: string;
};

/** How often the row is re-read while waiting. */
const POLL_MS = 2000;

/**
 * Asks a driver's handset where it is.
 *
 * The exchange is deliberately visible rather than a spinner that either
 * resolves or does not: a phone that is off, out of coverage or force-stopped
 * never replies, and "no answer" is a real outcome the office needs told
 * plainly — not something to sit and wait through.
 */
export function LocatePanel({
  drivers,
  initialDriver,
}: {
  drivers: { uuid: string; username: string }[];
  initialDriver: string | null;
}) {
  const [driver, setDriver] = useState(initialDriver ?? drivers[0]?.uuid ?? '');
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setWaiting(false);
  }, []);

  // Clearing the interval on unmount matters more than usual here: this polls
  // every two seconds, and a stray timer would keep querying after the admin
  // has navigated away.
  useEffect(() => stop, [stop]);

  async function request() {
    stop();
    setError(null);
    setRow(null);

    if (!driver) {
      setError('Pick a driver first.');
      return;
    }

    const supabase = createClient();
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) {
      setError('Your session has expired — sign in again.');
      return;
    }

    // The row goes in before the push, so a handset that answers immediately
    // always has something to write to.
    const { data: created, error: insertError } = await supabase
      .from('location_requests')
      .insert({ owner_id: session.user.id, user_uuid: driver })
      .select('id, status, lat, lon, accuracy_m, fixed_at, error, expires_at')
      .single();

    if (insertError || !created) {
      setError(describeError(insertError ?? { message: 'Could not start the request.' }));
      return;
    }

    setRow(created as Row);
    setWaiting(true);

    const { error: pushError } = await supabase.functions.invoke('request-location', {
      body: { requestId: created.id },
    });
    if (pushError) {
      // Not fatal on its own: the function marks the row failed with a reason,
      // and the poll below will pick that up and show it.
      console.warn('[locate] push call failed', pushError);
    }

    timer.current = setInterval(async () => {
      const { data } = await supabase
        .from('location_requests')
        .select('id, status, lat, lon, accuracy_m, fixed_at, error, expires_at')
        .eq('id', created.id)
        .maybeSingle();

      if (!data) return;
      setRow(data as Row);

      if (data.status !== 'pending' || new Date(data.expires_at) < new Date()) {
        stop();
      }
    }, POLL_MS);
  }

  const expired =
    row?.status === 'pending' && new Date(row.expires_at) < new Date() && !waiting;
  const located = row?.status === 'answered' && row.lat != null && row.lon != null;
  const name = drivers.find((d) => d.uuid === driver)?.username ?? 'this driver';

  return (
    <>
      <Box style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>DRIVER</div>
            <select
              className="input"
              style={{ marginTop: 4 }}
              value={driver}
              disabled={waiting}
              onChange={(e) => setDriver(e.target.value)}
            >
              {drivers.length === 0 && <option value="">No drivers yet</option>}
              {drivers.map((d) => (
                <option key={d.uuid} value={d.uuid}>
                  {d.username}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            onClick={request}
            disabled={waiting || drivers.length === 0}
            style={{ height: 42 }}
          >
            {waiting ? 'Asking…' : 'Request location'}
          </button>
        </div>
      </Box>

      {error && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</span>
        </Box>
      )}

      {waiting && (
        <Box style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13.5 }}>
            Waiting for {name}&rsquo;s handset to answer…
          </p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            The phone has to be switched on and have a connection. It does not
            need the app open, but a force-stopped app cannot be woken.
          </p>
        </Box>
      )}

      {row?.status === 'failed' && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>Could not reach the handset</strong>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {row.error ?? 'The push was not delivered.'}
          </p>
        </Box>
      )}

      {expired && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>No answer</strong>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {name}&rsquo;s phone did not reply in time. It may be switched off,
            out of coverage, or the app may have been force-stopped.
          </p>
        </Box>
      )}

      {located && (
        <>
          <Box style={{ padding: 0, marginBottom: 14 }}>
            <StreetMap track={[{ lat: row!.lat!, lon: row!.lon! }]} height={340} />
          </Box>
          <Box style={{ padding: 0 }}>
            <div className="scroll-x">
              <table className="tight">
                <tbody>
                  <tr>
                    <td className="muted" style={{ width: '38%' }}>Driver</td>
                    <td>{name}</td>
                  </tr>
                  <tr>
                    <td className="muted">Fix taken</td>
                    <td>{row!.fixed_at ? fmtDateTime(row!.fixed_at) : '—'}</td>
                  </tr>
                  <tr>
                    <td className="muted">Accuracy</td>
                    <td className="metric" style={{ fontWeight: 400 }}>
                      {row!.accuracy_m == null ? '—' : `±${Math.round(row!.accuracy_m)} m`}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Coordinates</td>
                    <td className="metric" style={{ fontWeight: 400 }}>
                      {row!.lat!.toFixed(5)}, {row!.lon!.toFixed(5)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Box>
        </>
      )}
    </>
  );
}
