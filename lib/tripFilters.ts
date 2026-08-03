import type { Trip } from '@/lib/types';
import { avgSpeedMps, elapsedSeconds } from '@/lib/format';

/**
 * Filters for the journeys table, carried in the URL so a filtered view can be
 * linked, reloaded and paged through.
 *
 * Three of the six are real columns and are pushed down to Postgres. **Time**
 * and **Avg** are not: elapsed time is `end_time − start_time − paused_seconds`
 * and average speed divides distance by moving time, neither of which exists to
 * filter on. They are applied here instead, which is why the page filters and
 * paginates in memory rather than with `.range()`. Moving them into a database
 * view would let all six push down; see the README.
 */
export type TripFilters = {
  /** Sri Lankan calendar dates, `YYYY-MM-DD`. */
  from: string | null;
  to: string | null;
  /** Rupees. */
  amin: number | null;
  amax: number | null;
  /** Kilometres. */
  dmin: number | null;
  dmax: number | null;
  /** Minutes. */
  tmin: number | null;
  tmax: number | null;
  /** Average speed, km/h. */
  vmin: number | null;
  vmax: number | null;
  /** Maximum speed, km/h. */
  xmin: number | null;
  xmax: number | null;
};

export const EMPTY: TripFilters = {
  from: null, to: null,
  amin: null, amax: null,
  dmin: null, dmax: null,
  tmin: null, tmax: null,
  vmin: null, vmax: null,
  xmin: null, xmax: null,
};

export const NUMERIC_KEYS = [
  'amin', 'amax', 'dmin', 'dmax', 'tmin', 'tmax', 'vmin', 'vmax', 'xmin', 'xmax',
] as const;

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const date = (v: string | undefined): string | null =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

export function parseFilters(sp: Record<string, string | string[] | undefined>): TripFilters {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const out = { ...EMPTY, from: date(one('from')), to: date(one('to')) };
  for (const k of NUMERIC_KEYS) out[k] = num(one(k));
  return out;
}

/** Serialises to a query string, omitting anything unset. */
export function filterQuery(f: TripFilters): string {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  for (const k of NUMERIC_KEYS) if (f[k] != null) p.set(k, String(f[k]));
  return p.toString();
}

export const activeCount = (f: TripFilters) =>
  (f.from ? 1 : 0) + (f.to ? 1 : 0) + NUMERIC_KEYS.filter((k) => f[k] != null).length;

/**
 * Sri Lanka is a fixed UTC+05:30 with no daylight saving, so a calendar date
 * maps to an instant by literal offset. `to` covers the whole of its day.
 */
export const dayStartUtc = (day: string) => `${day}T00:00:00+05:30`;
export const dayEndUtc = (day: string) => `${day}T23:59:59.999+05:30`;

/** The filters that only exist once a row has been read. */
export function matchesComputed(t: Trip, f: TripFilters): boolean {
  if (f.tmin != null || f.tmax != null) {
    const mins = elapsedSeconds(t) / 60;
    if (f.tmin != null && mins < f.tmin) return false;
    if (f.tmax != null && mins > f.tmax) return false;
  }
  if (f.vmin != null || f.vmax != null) {
    const kmh = avgSpeedMps(t) * 3.6;
    if (f.vmin != null && kmh < f.vmin) return false;
    if (f.vmax != null && kmh > f.vmax) return false;
  }
  return true;
}
