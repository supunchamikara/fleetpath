import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Box, StatTile } from '@/components/Blueprint';
import { TripMap } from '@/components/TripMap';
import type { Trip, Driver } from '@/lib/types';
import {
  km, kmh, duration, elapsedSeconds, avgSpeedMps, fmtTime, fmtDay, rupees,
  fmtClock, fmtDateTime,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const supabase = createClient(await cookies());

  // The full track is wanted here — this is the one place it is worth loading.
  const { data, error } = await supabase.from('trips').select('*').eq('uuid', uuid).maybeSingle();

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load this journey</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
      </Box>
    );
  }
  if (!data) notFound();

  const trip = data as Trip;
  let driver: Driver | null = null;
  if (trip.user_uuid) {
    const { data: d } = await supabase
      .from('app_users')
      .select('*')
      .eq('uuid', trip.user_uuid)
      .maybeSingle();
    driver = (d as Driver) ?? null;
  }

  const elapsed = elapsedSeconds(trip);
  const idle = Math.max(0, elapsed - trip.moving_seconds);
  const track = Array.isArray(trip.track) ? trip.track : [];

  const rows: [string, string][] = [
    ['Amount', rupees(trip.amount)],
    ['Date', fmtDay(trip.start_time)],
    ['Start time', fmtClock(trip.start_time)],
    ['End time', trip.end_time ? fmtClock(trip.end_time) : '—'],
    ['Driver', driver?.username ?? '—'],
    ['Device', trip.device_id ?? '—'],
    ['From', trip.start_address ?? '—'],
    ['To', trip.end_address ?? '—'],
    ['Moving time', duration(trip.moving_seconds)],
    ['Idle / stops', `${duration(idle)} · ${trip.stop_count} stop${trip.stop_count === 1 ? '' : 's'}`],
    ['Average speed', `${kmh(avgSpeedMps(trip))} km/h`],
    ['Maximum speed', `${kmh(trip.max_speed_mps)} km/h`],
    ['GPS fixes', String(track.length)],
    ['Record id', trip.uuid],
    ['Uploaded', fmtDateTime(trip.uploaded_at)],
  ];

  return (
    <>
      <Link href="/dashboard/trips" style={{ color: 'var(--accent)', fontSize: 14 }}>
        ← All journeys
      </Link>
      <div className="kicker" style={{ marginTop: 16 }}>
        {fmtDay(trip.start_time)} · {fmtTime(trip.start_time)}
      </div>
      <h1 style={{ margin: '4px 0 20px' }}>Trip #{trip.trip_number}</h1>

      <Box style={{ padding: 0, marginBottom: 18 }}>
        <TripMap track={track} height={340} />
      </Box>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 22 }}
      >
        <StatTile label="Amount" value={rupees(trip.amount)} highlight />
        <StatTile label="Distance" value={km(trip.distance_meters)} unit="km" />
        <StatTile label="Duration" value={duration(elapsed)} />
        <StatTile label="Avg speed" value={kmh(avgSpeedMps(trip))} unit="km/h" />
        <StatTile label="Max speed" value={kmh(trip.max_speed_mps)} unit="km/h" />
      </div>

      <Box style={{ padding: 0 }}>
        <div className="scroll-x">
          <table className="tight">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="muted" style={{ width: '38%' }}>{label}</td>
                  <td className="metric" style={{ fontWeight: 400 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </>
  );
}
