import { Box } from '@/components/Blueprint';
import type { Trip } from '@/lib/types';
import { km, duration, elapsedSeconds, rupees } from '@/lib/format';

export type Summary = {
  trips: number;
  meters: number;
  seconds: number;
  amount: number;
  /** Journeys carrying a fare. The average divides by this, not by `trips`. */
  priced: number;
};

export function summarise(rows: Trip[]): Summary {
  return rows.reduce<Summary>(
    (a, t) => ({
      trips: a.trips + 1,
      meters: a.meters + t.distance_meters,
      seconds: a.seconds + elapsedSeconds(t),
      amount: a.amount + (t.amount ?? 0),
      priced: a.priced + (t.amount == null ? 0 : 1),
    }),
    { trips: 0, meters: 0, seconds: 0, amount: 0, priced: 0 },
  );
}

/**
 * One period's takings and mileage.
 *
 * Journeys recorded before the fare prompt existed carry no amount. They still
 * count as journeys and still add distance, but they contribute nothing to the
 * takings — so the total is a floor, and the average is over the priced ones
 * only. Both are said out loud rather than quietly folding a missing fare in
 * as a zero, which would drag the average down and read as fact.
 */
export function SummaryCard({
  label,
  period,
  s,
  compare,
  highlight = false,
}: {
  label: string;
  period: string;
  s: Summary;
  /** The period this one is measured against, for the change line. */
  compare?: Summary;
  highlight?: boolean;
}) {
  const unpriced = s.trips - s.priced;

  let change: string | null = null;
  if (compare) {
    if (compare.amount === 0) {
      // A rise from nothing is not a percentage.
      change = s.amount > 0 ? 'no takings the month before' : null;
    } else {
      const pct = ((s.amount - compare.amount) / compare.amount) * 100;
      const rounded = Math.abs(pct) < 0.5 ? 0 : Math.round(pct);
      change = `${rounded > 0 ? '+' : ''}${rounded}% vs last month`;
    }
  }

  return (
    <Box style={highlight ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="kicker">{label}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{period}</div>

      <div
        className="metric"
        style={{
          fontSize: 30,
          marginTop: 12,
          color: highlight ? 'var(--accent)' : undefined,
        }}
      >
        {/* No priced journey means the takings are unknown, not zero — the
            same distinction the per-trip and per-day figures make. */}
        {s.priced === 0 ? '—' : rupees(s.amount)}
      </div>
      {change && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{change}</div>}

      <div style={{ fontSize: 13.5, marginTop: 12 }}>
        {s.trips} journey{s.trips === 1 ? '' : 's'} · {km(s.meters)} km
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        {duration(s.seconds)} on the road
        {s.priced > 0 && ` · ${rupees(s.amount / s.priced)} avg fare`}
      </div>

      {unpriced > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {unpriced} journey{unpriced === 1 ? '' : 's'} with no fare recorded, so
          takings are at least this much.
        </div>
      )}
    </Box>
  );
}
