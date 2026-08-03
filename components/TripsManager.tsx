'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Box } from '@/components/Blueprint';
import { describeError } from '@/lib/errors';
import type { Trip } from '@/lib/types';
import {
  km,
  kmh,
  duration,
  elapsedSeconds,
  avgSpeedMps,
  fmtTime,
  relativeDay,
  dayKey,
  rupees,
  parseRupees,
} from '@/lib/format';

/**
 * The journeys table, grouped by day, with the two edits the office is allowed
 * to make: correct a fare, or remove a record outright.
 *
 * Only the amount is editable. Everything else — distance, timings, the GPS
 * track — is measured on the phone, and a dashboard that could rewrite it would
 * turn the journey log into something nobody can trust. The fare is different:
 * it is typed by a driver at the kerb, so it is the one field that genuinely
 * needs correcting from a desk.
 */
export function TripsManager({
  initial,
  drivers,
  page,
  size,
  total,
  sizes,
  query = '',
}: {
  initial: Trip[];
  drivers: Record<string, string>;
  page: number;
  size: number;
  total: number;
  sizes: number[];
  /** Serialised filters, carried through every pager link. */
  query?: string;
}) {
  const router = useRouter();
  // Derived, not hardcoded: the pager should follow wherever this table is
  // mounted rather than assuming /dashboard/trips.
  const pathname = usePathname();
  const [trips, setTrips] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(trip: Trip) {
    setError(null);
    setEditing(trip.uuid);
    setValue(trip.amount == null ? '' : String(trip.amount));
  }

  async function saveAmount(trip: Trip) {
    const amount = parseRupees(value);
    if (amount === null) {
      setError('Enter the amount in rupees — a number, not below zero.');
      return;
    }

    setBusy(true);
    // `.select()` matters: with row level security a rejected write is not an
    // error, it simply matches no rows. Without reading back what changed, a
    // blocked update looks exactly like a successful one.
    const { data, error: err } = await createClient()
      .from('trips')
      .update({ amount })
      .eq('uuid', trip.uuid)
      .select('uuid, amount');
    setBusy(false);

    if (err) {
      setError(describeError(err));
      return;
    }
    if (!data || data.length === 0) {
      setError(
        'The fare was not saved — no row matched. Re-run supabase/schema.sql so ' +
          'the update policy on trips exists.',
      );
      return;
    }

    setTrips((prev) =>
      prev.map((t) => (t.uuid === trip.uuid ? { ...t, amount } : t)),
    );
    setEditing(null);
    router.refresh();
  }

  async function remove(trip: Trip) {
    const label = `#${trip.trip_number} on ${relativeDay(trip.start_time)}`;
    if (
      !confirm(
        `Delete journey ${label}?\n\nThe route, timings and fare are removed ` +
          'from the cloud for good. The phone that recorded it keeps its own ' +
          'copy, and will not re-upload it.',
      )
    ) {
      return;
    }

    setBusy(true);
    const { data, error: err } = await createClient()
      .from('trips')
      .delete()
      .eq('uuid', trip.uuid)
      .select('uuid');
    setBusy(false);

    if (err) {
      setError(describeError(err));
      return;
    }
    if (!data || data.length === 0) {
      setError(
        'Nothing was deleted — row level security matched no rows. Re-run ' +
          'supabase/schema.sql to add the delete policy on trips.',
      );
      return;
    }

    setTrips((prev) => prev.filter((t) => t.uuid !== trip.uuid));
    router.refresh();
  }

  // Regrouped from local state so a delete or a corrected fare updates the day
  // totals immediately, without a round trip.
  const groups = new Map<string, Trip[]>();
  for (const t of trips) {
    const key = dayKey(t.start_time);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const pages = Math.max(1, Math.ceil(total / size));
  const firstShown = total === 0 ? 0 : (page - 1) * size + 1;
  const lastShown = (page - 1) * size + trips.length;
  // The filters ride along with every page and size change; dropping them
  // would silently widen the result set under the reader.
  const href = (p: number, s: number) =>
    `${pathname}?${query ? `${query}&` : ''}page=${p}&size=${s}`;

  const pager = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        margin: '14px 0',
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>
        {total === 0 ? 'No journeys' : `${firstShown}–${lastShown} of ${total}`}
      </span>

      <span style={{ flex: 1 }} />

      <label className="muted" style={{ fontSize: 13 }}>
        Per page{' '}
        <select
          className="input"
          value={size}
          // Changing the size changes which rows a page number refers to, so
          // go back to page 1 rather than a position that means nothing now.
          onChange={(e) => router.push(href(1, Number(e.target.value)))}
          style={{ width: 'auto', padding: '4px 8px', marginLeft: 4 }}
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          className="btn"
          disabled={page <= 1}
          onClick={() => router.push(href(page - 1, size))}
          style={{ padding: '4px 10px', fontSize: 12.5 }}
        >
          ← Prev
        </button>
        <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          Page {page} of {pages}
        </span>
        <button
          className="btn"
          disabled={page >= pages}
          onClick={() => router.push(href(page + 1, size))}
          style={{ padding: '4px 10px', fontSize: 12.5 }}
        >
          Next →
        </button>
      </div>
    </div>
  );

  return (
    <>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 640, marginBottom: 4 }}>
        The amount can be corrected here; everything else is what the phone
        measured. Deleting removes the journey from the cloud only — the handset
        keeps its own copy. Day totals cover the rows on this page, so a day
        split across two pages is counted on each.
      </p>

      {pager}

      {error && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 14 }}>
          <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</span>
        </Box>
      )}

      {trips.length === 0 && (
        <Box>
          <p className="muted" style={{ fontSize: 14 }}>
            {query ? 'No journeys match these filters.' : 'Nothing synced yet.'}
          </p>
        </Box>
      )}

      {[...groups.entries()].map(([key, dayTrips]) => {
        const meters = dayTrips.reduce((a, t) => a + t.distance_meters, 0);
        // Journeys predating the fare prompt carry null and add nothing. A day
        // where none of them has a fare shows "—", not "Rs 0.00": the takings
        // are unknown, which is not the same as having taken nothing.
        const priced = dayTrips.filter((t) => t.amount != null);
        const takings = priced.length
          ? priced.reduce((a, t) => a + (t.amount ?? 0), 0)
          : null;
        return (
          <section key={key} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
              <div className="kicker" style={{ flex: 1 }}>
                {relativeDay(dayTrips[0].start_time)}
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {rupees(takings)} · {km(meters)} km · {dayTrips.length} trip
                {dayTrips.length === 1 ? '' : 's'}
              </span>
            </div>
            <Box style={{ padding: 0 }}>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Start</th>
                      <th>Driver</th>
                      <th>Route</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>Distance</th>
                      <th style={{ textAlign: 'right' }}>Time</th>
                      <th style={{ textAlign: 'right' }}>Avg</th>
                      <th style={{ textAlign: 'right' }}>Max</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayTrips.map((t) => {
                      const isEditing = editing === t.uuid;
                      return (
                        <tr key={t.id}>
                          <td>
                            <Link
                              href={`/dashboard/trips/${t.uuid}`}
                              style={{ color: 'var(--accent)' }}
                            >
                              #{t.trip_number}
                            </Link>
                          </td>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                            {fmtTime(t.start_time)}
                          </td>
                          <td>{t.user_uuid ? drivers[t.user_uuid] ?? '—' : '—'}</td>
                          <td style={{ maxWidth: 340 }}>
                            {(t.start_address ?? '—')} → {(t.end_address ?? '—')}
                          </td>
                          <td className="metric" style={{ textAlign: 'right' }}>
                            {isEditing ? (
                              <input
                                className="input"
                                autoFocus
                                inputMode="decimal"
                                value={value}
                                disabled={busy}
                                onChange={(e) => {
                                  setValue(e.target.value);
                                  setError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveAmount(t);
                                  if (e.key === 'Escape') setEditing(null);
                                }}
                                style={{ width: 110, textAlign: 'right', padding: '4px 8px' }}
                              />
                            ) : (
                              rupees(t.amount)
                            )}
                          </td>
                          <td className="metric" style={{ textAlign: 'right' }}>
                            {km(t.distance_meters)} km
                          </td>
                          <td className="metric" style={{ textAlign: 'right' }}>
                            {duration(elapsedSeconds(t))}
                          </td>
                          <td className="metric" style={{ textAlign: 'right' }}>
                            {kmh(avgSpeedMps(t))}
                          </td>
                          <td className="metric" style={{ textAlign: 'right' }}>
                            {kmh(t.max_speed_mps)}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isEditing ? (
                              <>
                                <button
                                  className="btn btn-primary"
                                  disabled={busy}
                                  onClick={() => saveAmount(t)}
                                  style={{ padding: '4px 10px', fontSize: 12.5 }}
                                >
                                  Save
                                </button>{' '}
                                <button
                                  className="btn"
                                  disabled={busy}
                                  onClick={() => setEditing(null)}
                                  style={{ padding: '4px 10px', fontSize: 12.5 }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn"
                                  disabled={busy}
                                  onClick={() => startEdit(t)}
                                  style={{ padding: '4px 10px', fontSize: 12.5 }}
                                >
                                  Edit amount
                                </button>{' '}
                                <button
                                  className="btn"
                                  disabled={busy}
                                  onClick={() => remove(t)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 12.5,
                                    color: 'var(--danger)',
                                    borderColor: 'var(--danger)',
                                  }}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Box>
          </section>
        );
      })}

      {/* Repeated at the foot: with 100 rows on screen the top control has
          scrolled well out of reach by the time you want the next page. */}
      {pages > 1 && pager}
    </>
  );
}
