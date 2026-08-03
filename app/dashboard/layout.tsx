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
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 24, height: 62 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 22, height: 22, background: 'var(--accent)' }} />
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: '0.06em',
              }}
            >
              FLEETPATH
            </span>
          </div>
          <NavTabs />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{user?.email ?? 'signed in'}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="wrap" style={{ padding: '28px 24px 60px' }}>{children}</main>
    </>
  );
}
