import { cookies } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Box } from '@/components/Blueprint';
import { SummaryCard, summarise } from '@/components/SummaryCard';
import type { Trip, Driver } from '@/lib/types';
import {
  km, kmh, duration, elapsedSeconds, avgSpeedMps, fmtTime, relativeDay, rupees,
  monthKey, monthKeyOf, monthName, shiftMonthKey,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const supabase = createClient(await cookies());

  // No limit: an "all time" total taken from the most recent 500 journeys is
  // not an all-time total, it just looks like one. `count` is the real number
  // of rows in the table, so a truncated fetch can be detected and said out
  // loud rather than quietly under-reporting money.
  const { data: trips, error, count } = await supabase
    .from('trips')
    // Written out rather than built from a constant: supabase-js parses this
    // literal at type level, and a variable degrades the result to an error
    // type. `track` stays out — it is the heavy column and nothing here reads it.
    .select(
      'id, uuid, device_id, user_uuid, trip_number, start_time, end_time, start_address, end_address, distance_meters, moving_seconds, paused_seconds, max_speed_mps, stop_count, amount, status, uploaded_at',
      { count: 'exact' },
    )
    .order('start_time', { ascending: false });

  const { data: drivers } = await supabase.from('app_users').select('*');

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load journeys</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          If this says the table is missing, run <code>supabase/schema.sql</code> in
          the Supabase SQL editor.
        </p>
      </Box>
    );
  }

  const rows = (trips ?? []) as Trip[];
  const byDriver = new Map((drivers ?? []).map((d: Driver) => [d.uuid, d.username]));
  const truncated = count != null && rows.length < count;

  // Months are Sri Lankan calendar months. Comparing `YYYY-MM` keys sidesteps
  // boundary arithmetic entirely: a journey belongs to the month it happened in
  // where it happened, whatever timezone this page is rendered from.
  const thisKey = monthKeyOf(new Date());
  const lastKey = shiftMonthKey(thisKey, -1);

  const thisMonth = summarise(rows.filter((t) => monthKey(t.start_time) === thisKey));
  const lastMonth = summarise(rows.filter((t) => monthKey(t.start_time) === lastKey));
  const allTime = summarise(rows);

  return (
    <>
      <div className="kicker">Fleet overview</div>
      <h1 style={{ margin: '4px 0 6px' }}>Summary</h1>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>
        {allTime.trips} journey{allTime.trips === 1 ? '' : 's'} from{' '}
        {(drivers ?? []).length} driver{(drivers ?? []).length === 1 ? '' : 's'}.
      </p>

      {truncated && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>
            Only {rows.length} of {count} journeys were returned, so these totals
            are incomplete. The API is capping the result set — raise the row
            limit on the project, or move these figures into a database view.
          </span>
        </Box>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}
      >
        <SummaryCard
          label="This month"
          period={monthName(thisKey)}
          s={thisMonth}
          compare={lastMonth}
          highlight
        />
        <SummaryCard
          label="Last month"
          period={monthName(lastKey)}
          s={lastMonth}
        />
        <SummaryCard label="All time" period="Every synced journey" s={allTime} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', margin: '32px 0 10px' }}>
        <h2 style={{ flex: 1 }}>Recent journeys</h2>
        <Link href="/dashboard/trips" style={{ color: 'var(--accent)', fontSize: 14 }}>
          See all
        </Link>
      </div>

      {rows.length === 0 ? (
        <Box>
          <p className="muted" style={{ fontSize: 14 }}>
            No journeys have synced yet. Record one on a phone and tap
            <strong> Sync now</strong>, or wait for it to join Wi-Fi.
          </p>
        </Box>
      ) : (
        <Box style={{ padding: 0 }}>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>When</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Distance</th>
                  <th style={{ textAlign: 'right' }}>Time</th>
                  <th style={{ textAlign: 'right' }}>Avg</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/dashboard/trips/${t.uuid}`} style={{ color: 'var(--accent)' }}>
                        #{t.trip_number}
                      </Link>
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {relativeDay(t.start_time)} · {fmtTime(t.start_time)}
                    </td>
                    <td>{t.user_uuid ? byDriver.get(t.user_uuid) ?? '—' : '—'}</td>
                    <td style={{ maxWidth: 320 }}>
                      {(t.start_address ?? '—')} → {(t.end_address ?? '—')}
                    </td>
                    <td className="metric" style={{ textAlign: 'right' }}>{rupees(t.amount)}</td>
                    <td className="metric" style={{ textAlign: 'right' }}>{km(t.distance_meters)} km</td>
                    <td className="metric" style={{ textAlign: 'right' }}>{duration(elapsedSeconds(t))}</td>
                    <td className="metric" style={{ textAlign: 'right' }}>{kmh(avgSpeedMps(t))} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}
    </>
  );
}
