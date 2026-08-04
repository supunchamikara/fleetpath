import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { driverScope } from '@/lib/driverScope.server';
import { Box } from '@/components/Blueprint';
import { TripsManager } from '@/components/TripsManager';
import { TripFiltersBar } from '@/components/TripFilters';
import type { Trip, Driver } from '@/lib/types';
import {
  dayEndUtc,
  dayStartUtc,
  filterQuery,
  matchesComputed,
  parseFilters,
} from '@/lib/tripFilters';

export const dynamic = 'force-dynamic';

// The sizes the picker offers. Anything else in the URL falls back to 50.
// Not exported: a page module may only export Next's own reserved names.
const PAGE_SIZES = [50, 100] as const;

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = createClient(await cookies());
  const scope = await driverScope();

  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const requested = Number(one('size'));
  const size = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : 50;
  const page = Math.max(1, Math.floor(Number(one('page'))) || 1);
  const filters = parseFilters(sp);

  let query = supabase
    .from('trips')
    .select(
      'id, uuid, device_id, user_uuid, trip_number, start_time, end_time, start_address, end_address, distance_meters, moving_seconds, paused_seconds, max_speed_mps, stop_count, amount, status, uploaded_at',
      { count: 'exact' },
    )
    .order('start_time', { ascending: false });

  // The header's scope, applied before the per-page filters below.
  if (scope) query = query.eq('user_uuid', scope);

  // Pushed down to Postgres: these are real columns, so the database can do the
  // narrowing instead of shipping rows here to be discarded.
  if (filters.from) query = query.gte('start_time', dayStartUtc(filters.from));
  if (filters.to) query = query.lte('start_time', dayEndUtc(filters.to));
  if (filters.amin != null) query = query.gte('amount', filters.amin);
  if (filters.amax != null) query = query.lte('amount', filters.amax);
  if (filters.dmin != null) query = query.gte('distance_meters', filters.dmin * 1000);
  if (filters.dmax != null) query = query.lte('distance_meters', filters.dmax * 1000);
  if (filters.xmin != null) query = query.gte('max_speed_mps', filters.xmin / 3.6);
  if (filters.xmax != null) query = query.lte('max_speed_mps', filters.xmax / 3.6);

  const { data: trips, error, count } = await query;

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load journeys</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
      </Box>
    );
  }

  const fetched = (trips ?? []) as Trip[];
  const truncated = count != null && fetched.length < count;

  // Time and Avg have no column to filter on, so they are applied here — which
  // is also why paging is a slice rather than `.range()`: the total has to be
  // the count of what actually matched, not what the database returned.
  const matched = fetched.filter((t) => matchesComputed(t, filters));
  const total = matched.length;
  const pages = Math.max(1, Math.ceil(total / size));

  const query$ = filterQuery(filters);
  if (page > pages && total > 0) {
    redirect(`/dashboard/trips?${query$ ? `${query$}&` : ''}page=${pages}&size=${size}`);
  }

  const rows = matched.slice((page - 1) * size, page * size);

  const { data: drivers } = await supabase.from('app_users').select('*');
  const byDriver = Object.fromEntries(
    (drivers ?? []).map((d: Driver) => [d.uuid, d.username]),
  );

  return (
    <>
      <div className="kicker">All journeys</div>
      <h1 style={{ margin: '4px 0 6px' }}>Journeys</h1>

      <TripFiltersBar filters={filters} size={size} matched={total} />

      {truncated && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 14 }}>
          <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>
            Only {fetched.length} of {count} matching journeys were returned, so
            the Time and Avg filters and the totals below are incomplete.
          </span>
        </Box>
      )}

      {/* `key` remounts on any change to the result set: TripsManager seeds its
          state from `initial`, and useState ignores later prop values. */}
      <TripsManager
        key={`${page}-${size}-${query$}`}
        initial={rows}
        drivers={byDriver}
        page={page}
        size={size}
        total={total}
        sizes={[...PAGE_SIZES]}
        query={query$}
      />
    </>
  );
}
