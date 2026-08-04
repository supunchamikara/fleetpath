'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DRIVER_COOKIE, DRIVER_COOKIE_MAX_AGE } from '@/lib/driverScope';

const write = (value: string) => {
  document.cookie =
    `${DRIVER_COOKIE}=${value}; path=/; max-age=${DRIVER_COOKIE_MAX_AGE}; samesite=lax`;
};

/**
 * Scopes the dashboard to one driver, or to all of them.
 *
 * The cookie is set here rather than through a server action because the
 * server components that read it cannot write it back — the same limitation
 * the Supabase cookie handler works around. `refresh()` is what makes the
 * change take: it re-runs the server components with the new cookie attached.
 */
export function DriverPicker({
  drivers,
  value,
}: {
  drivers: { uuid: string; username: string }[];
  /** Raw cookie value, which may name a driver who has since been removed. */
  value: string;
}) {
  const router = useRouter();
  const known = value === 'all' || drivers.some((d) => d.uuid === value);

  // A driver deleted while the dashboard was scoped to them would otherwise
  // leave every page empty under a picker reading "All drivers". Fall back
  // rather than stranding the view somewhere it cannot be steered out of.
  useEffect(() => {
    if (known) return;
    write('all');
    router.refresh();
  }, [known, router]);

  return (
    <label className="top-scope">
      <span className="muted">Driver</span>
      <select
        value={known ? value : 'all'}
        onChange={(e) => {
          write(e.target.value);
          router.refresh();
        }}
      >
        <option value="all">All drivers</option>
        {drivers.map((d) => (
          <option key={d.uuid} value={d.uuid}>
            {d.username}
          </option>
        ))}
      </select>
    </label>
  );
}
