'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/trips', label: 'Journeys' },
  { href: '/dashboard/loan', label: 'Loan' },
  { href: '/dashboard/drivers', label: 'Drivers' },
  { href: '/dashboard/locate', label: 'Locate' },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="nav-tabs">
      {TABS.map((t) => {
        const active =
          t.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? 'on' : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
