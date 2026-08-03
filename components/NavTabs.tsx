'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/trips', label: 'Journeys' },
  { href: '/dashboard/loan', label: 'Loan' },
  { href: '/dashboard/drivers', label: 'Drivers' },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav style={{ display: 'flex', gap: 18, marginLeft: 10 }}>
      {TABS.map((t) => {
        const active =
          t.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 15,
              paddingBottom: 2,
              color: active ? 'var(--accent)' : undefined,
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
