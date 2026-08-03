import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { Box } from '@/components/Blueprint';
import { DriversManager } from '@/components/DriversManager';
import type { Driver, Trip } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const supabase = createClient(await cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: drivers, error } = await supabase
    .from('app_users')
    .select('*')
    .order('username');

  const { data: trips } = await supabase
    .from('trips')
    .select('user_uuid, distance_meters')
    .limit(5000);

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load drivers</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          If this mentions <code>pin_hash</code>, re-run <code>supabase/schema.sql</code> —
          the roster gained columns when driver management moved to the web.
        </p>
      </Box>
    );
  }

  const stats: Record<string, { trips: number; meters: number }> = {};
  for (const t of (trips ?? []) as Pick<Trip, 'user_uuid' | 'distance_meters'>[]) {
    if (!t.user_uuid) continue;
    const s = stats[t.user_uuid] ?? { trips: 0, meters: 0 };
    s.trips += 1;
    s.meters += t.distance_meters;
    stats[t.user_uuid] = s;
  }

  return (
    <>
      <div className="kicker">Roster</div>
      <h1 style={{ margin: '4px 0 16px' }}>Drivers</h1>
      <DriversManager
        initial={(drivers ?? []) as Driver[]}
        stats={stats}
        ownerId={user!.id}
      />
    </>
  );
}
