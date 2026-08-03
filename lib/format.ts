/** Mirrors the app's Units/Fmt helpers so the numbers read identically. */

export const km = (meters: number) => {
  const v = meters / 1000;
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
};

export const kmh = (mps: number) => (mps * 3.6).toFixed(0);

// en-LK, not en-IN: both are plausible here, but en-IN groups in lakhs
// (12,50,000.00) while the app's NumberFormat('#,##0.00') groups in thousands.
// The dashboard and the phone must show a fare the same way.
const money = new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "Rs 1,250.00" — matches Fmt.rupees in the app. Null reads as an em dash. */
export const rupees = (amount: number | null | undefined) =>
  amount == null ? '—' : `Rs ${money.format(amount)}`;

/**
 * Parses an edited fare, or null when it is not a usable amount. Mirrors
 * `Fmt.parseRupees` in the app so the dashboard and the phone accept and
 * reject exactly the same input.
 */
export function parseRupees(raw: string): number | null {
  const text = raw.trim().replace(/,/g, '');
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function elapsedSeconds(trip: {
  start_time: string;
  end_time: string | null;
  paused_seconds: number;
}): number {
  if (!trip.end_time) return 0;
  const ms = new Date(trip.end_time).getTime() - new Date(trip.start_time).getTime();
  return Math.max(0, ms / 1000 - trip.paused_seconds);
}

/** Average over moving time, falling back to elapsed — same rule as the app. */
export function avgSpeedMps(trip: {
  distance_meters: number;
  moving_seconds: number;
  start_time: string;
  end_time: string | null;
  paused_seconds: number;
}): number {
  const secs = trip.moving_seconds > 0 ? trip.moving_seconds : elapsedSeconds(trip);
  return secs > 0 ? trip.distance_meters / secs : 0;
}

/**
 * The fleet's timezone. Every timestamp in the database is an instant (UTC);
 * turning one into a wall-clock time or a calendar day needs a zone, and the
 * right zone is where the vehicles run — not where this happens to be rendered.
 *
 * These pages are **server components**, so without pinning it the answer came
 * from the host's clock. A dashboard rendered from a machine in Sydney showed
 * Colombo evenings as the following morning, which also pushed those journeys
 * into the wrong day and the wrong month for every takings total.
 */
export const TZ = 'Asia/Colombo';

const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});
const day = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});
const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});
const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: TZ,
});

export const fmtTime = (iso: string) => time.format(new Date(iso));
export const fmtDay = (iso: string) => day.format(new Date(iso));
/** "03/08/2026, 14:59" in Sri Lanka. */
export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
/** "14:59:32" in Sri Lanka. */
export const fmtClock = (iso: string) => clock.format(new Date(iso));

/**
 * The calendar day an instant falls on **in Sri Lanka**, as `YYYY-MM-DD`.
 *
 * `en-CA` is the shortcut to an ISO-ordered date; the value is only ever used
 * as a key or compared with another of its own kind, and both sort correctly
 * as plain strings.
 */
export const dayKeyOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

/** The calendar month an instant falls in, in Sri Lanka, as `YYYY-MM`. */
export const monthKeyOf = (d: Date) => dayKeyOf(d).slice(0, 7);

export const dayKey = (iso: string) => dayKeyOf(new Date(iso));

/**
 * Midday UTC on a `YYYY-MM-DD` key — a stable instant to do day arithmetic
 * with. Midday because it is far enough from either midnight that no offset or
 * daylight-saving shift can move it onto the neighbouring date.
 */
export const keyToDate = (key: string) => new Date(`${key}T12:00:00Z`);

/** Today's calendar day in Sri Lanka, as `YYYY-MM-DD`. */
export const todayKey = () => dayKeyOf(new Date());

/** Whole days from key `a` to key `b`. Negative when `b` is earlier. */
export const daysBetweenKeys = (a: string, b: string) =>
  Math.round((keyToDate(b).getTime() - keyToDate(a).getTime()) / 86_400_000);

/** Days in the calendar month of a `YYYY-MM` key. */
export function daysInMonthKey(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Shifts a `YYYY-MM` key by whole months. */
export function shiftMonthKey(key: string, by: number): string {
  const [y, m] = key.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** "August 2026" from a `YYYY-MM` key. */
export function monthName(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
export const monthKey = (iso: string) => monthKeyOf(new Date(iso));

export function relativeDay(iso: string): string {
  const key = dayKey(iso);
  const today = dayKeyOf(new Date());
  if (key === today) return 'Today';
  // Step back one Sri Lankan day by taking noon UTC of today's key and
  // subtracting 24h — noon is far enough from either midnight that the offset
  // cannot land on the wrong date.
  const yesterday = dayKeyOf(new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000));
  if (key === yesterday) return 'Yesterday';
  return fmtDay(iso);
}
