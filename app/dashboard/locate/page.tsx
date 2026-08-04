import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { driverScope } from '@/lib/driverScope.server';
import { Box } from '@/components/Blueprint';
import { LocatePanel } from '@/components/LocatePanel';
import type { Driver } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LocatePage() {
  const supabase = createClient(await cookies());
  const scope = await driverScope();

  const { data: roster, error } = await supabase
    .from('app_users')
    .select('uuid, username')
    .eq('active', true)
    .order('username');

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load the roster</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
      </Box>
    );
  }

  const drivers = (roster ?? []) as Pick<Driver, 'uuid' | 'username'>[];

  return (
    <>
      <div className="kicker">Live location</div>
      <h1 style={{ margin: '4px 0 6px' }}>Locate a driver</h1>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 640, marginBottom: 18 }}>
        Asks the handset for a single position fix. The phone answers in the
        background, so the driver does not have to open the app — but it has to
        be switched on and connected, and drivers should know this is here.
      </p>

      {/* Deactivated drivers are left out: they cannot sign in, so no handset
          is carrying their session to answer. */}
      <LocatePanel drivers={drivers} initialDriver={scope} />
    </>
  );
}
