import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { NavTabs } from '@/components/NavTabs';
import { SignOutButton } from '@/components/SignOutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The middleware already redirects anonymous visitors; this is only for the
  // header label.
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="wrap top-bar">
          <div className="top-brand">
            <div className="top-mark" />
            <span className="top-name">FLEETPATH</span>
          </div>
          <NavTabs />
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
