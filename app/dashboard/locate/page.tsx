import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { driverScope } from '@/lib/driverScope.server';
import { Box } from '@/components/Blueprint';
import { CurrentLocations, type Fix } from '@/components/CurrentLocations';
import type { Driver } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Row = {
  device_id: string;
  user_uuid: string | null;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  fixed_at: string;
};

export default async function CurrentLocationPage() {
  const supabase = createClient(await cookies());
  const scope = await driverScope();

  let query = supabase
    .from('driver_locations')
    .select('device_id, user_uuid, lat, lon, accuracy_m, fixed_at')
    .order('fixed_at', { ascending: false });

  if (scope) query = query.eq('user_uuid', scope);

  const { data, error } = await query;

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load locations</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          If this says the table is missing, re-run <code>supabase/schema.sql</code> in
          the Supabase SQL editor.
        </p>
      </Box>
    );
  }

  const { data: roster } = await supabase.from('app_users').select('uuid, username');
  const byUuid = new Map(
    ((roster ?? []) as Pick<Driver, 'uuid' | 'username'>[]).map((d) => [d.uuid, d.username]),
  );

  const fixes: Fix[] = ((data ?? []) as Row[]).map((r) => ({
    device_id: r.device_id,
    driver: r.user_uuid ? byUuid.get(r.user_uuid) ?? null : null,
    lat: r.lat,
    lon: r.lon,
    accuracy_m: r.accuracy_m,
    fixed_at: r.fixed_at,
  }));

  return (
    <>
      <div className="kicker">Live location</div>
      <h1 style={{ margin: '4px 0 6px' }}>Current location</h1>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 640, marginBottom: 18 }}>
        A handset posts where it is when the app is opened or returned to,
        at most once every 15 minutes and only between 06:00 and 18:00. It does
        not report while closed, so expect gaps across a long drive and treat
        these as last-known positions rather than a live feed. Times are when
        the fix was taken, not when it arrived. Drivers should be told this is
        here.
      </p>

      <CurrentLocations fixes={fixes} />
    </>
  );
}
