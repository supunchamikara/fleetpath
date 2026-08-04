import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { NavTabs } from '@/components/NavTabs';
import { SignOutButton } from '@/components/SignOutButton';
import { DriverPicker } from '@/components/DriverPicker';
import { DRIVER_COOKIE } from '@/lib/driverScope';
import type { Driver } from '@/lib/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  // The middleware already redirects anonymous visitors; this is only for the
  // header label.
  const supabase = createClient(store);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: roster } = await supabase
    .from('app_users')
    .select('uuid, username')
    .order('username');
  const drivers = (roster ?? []) as Pick<Driver, 'uuid' | 'username'>[];

  return (
    <>
      <header style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="wrap top-bar">
          <div className="top-brand">
            <div className="top-mark" />
            <span className="top-name">FLEETPATH</span>
          </div>
          <NavTabs />
          <DriverPicker
            drivers={drivers}
            value={store.get(DRIVER_COOKIE)?.value ?? 'all'}
          />
          <div className="top-account">
            <span className="muted top-email">{user?.email ?? 'signed in'}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="wrap page">{children}</main>
    </>
  );
}
