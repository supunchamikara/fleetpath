/**
 * Which driver the whole dashboard is looking at.
 *
 * Carried in a cookie rather than the query string: the picker sits in the
 * header, so it has to survive every navigation, and threading a parameter
 * through the nav tabs, the pager links, "See all" and every route link would
 * mean each one silently widening the scope the moment it was forgotten.
 *
 * The cost is that a scoped view is not shareable by URL. The per-page filters
 * on Journeys stay in the query string precisely because those are worth
 * sending to someone.
 *
 * Nothing here may import `next/headers`: the header picker is a client
 * component and needs these constants, and one server-only import in this
 * module would pull it into the browser bundle and fail the build. Reading the
 * cookie lives in `driverScope.server.ts` for that reason.
 */
export const DRIVER_COOKIE = 'fleet_driver';

/** A year: the office looks at one driver for a stretch, not for a session. */
export const DRIVER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The selected driver's uuid, or null for "All drivers". */
export const parseScope = (value: string | undefined): string | null =>
  !value || value === 'all' ? null : value;
