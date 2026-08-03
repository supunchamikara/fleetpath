import { Box } from '@/components/Blueprint';
import {
  dayKeyOf,
  daysBetweenKeys,
  daysInMonthKey,
  monthKeyOf,
  rupees,
  todayKey,
} from '@/lib/format';
import { type Instalment } from '@/lib/loan';
import { dueDate, type MonthEarnings } from '@/components/LoanSchedule';

export type Journey = { at: Date; amount: number | null };

const DAY = 86_400_000;
const RECENT_WINDOW_DAYS = 30;

/**
 * Whole days between two `YYYY-MM-DD` keys, never less than one so it can be
 * divided by. Keys rather than Dates: every span here is counted in Sri Lankan
 * calendar days, which is not what subtracting two instants gives you.
 */
const span = (a: string, b: string) => Math.max(1, daysBetweenKeys(a, b));

/** Shifts a day key back by whole days. */
const shiftDays = (key: string, by: number) =>
  dayKeyOf(new Date(Date.parse(`${key}T12:00:00Z`) + by * DAY));

function Tile({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <Box style={accent ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="kicker">{label}</div>
      <div
        className="metric"
        style={{ fontSize: 24, marginTop: 8, color: accent ? 'var(--accent)' : undefined }}
      >
        {value}
      </div>
      {note && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{note}</div>}
    </Box>
  );
}

const grid = (min: number) => ({
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
});

/**
 * What the vehicle has to earn per day to service the loan, what it is actually
 * earning, and where that lands.
 *
 * Every projection runs off one number — the recent daily rate — and that number
 * is only meaningful once there are journeys to measure. With none, the whole
 * section says so instead of dividing by zero and reporting a catastrophe.
 */
export function LoanAnalysis({
  plan,
  earnings,
  journeys,
  now = new Date(),
}: {
  plan: Instalment[];
  earnings: Map<string, MonthEarnings>;
  journeys: Journey[];
  now?: Date;
}) {
  const today = dayKeyOf(now);
  const firstDue = plan[0].dueKey;
  const lastDue = plan[plan.length - 1].dueKey;

  // ── what is owed ────────────────────────────────────────────────────────
  const totalDue = plan.reduce((a, i) => a + i.amount, 0);
  const termDays = span(firstDue, lastDue);
  const requiredWhole = totalDue / termDays;

  // "Remaining" means instalments not yet due. Without payment tracking that is
  // the honest definition — this page knows what is owed and what was earned,
  // not what has been settled.
  // `YYYY-MM-DD` keys sort correctly as plain strings, so a comparison is a
  // date comparison.
  const remaining = plan.filter((i) => i.dueKey >= today);
  const remainingDue = remaining.reduce((a, i) => a + i.amount, 0);
  const daysLeft = span(today, lastDue);
  const requiredRemaining = remainingDue / daysLeft;

  // ── this month ──────────────────────────────────────────────────────────
  const thisKey = today.slice(0, 7);
  const thisRow = plan.find((i) => i.monthKey === thisKey);
  const daysInMonth = daysInMonthKey(thisKey);
  const daysLeftInMonth = daysInMonth - Number(today.slice(8)) + 1;
  const earnedThisMonth = earnings.get(thisKey)?.amount ?? 0;
  const monthDue = thisRow?.amount ?? 0;
  const stillNeeded = Math.max(0, monthDue - earnedThisMonth);

  // ── what it earns ───────────────────────────────────────────────────────
  const priced = journeys.filter((j) => j.amount != null);
  const totalEarned = priced.reduce((a, j) => a + (j.amount ?? 0), 0);
  const hasData = priced.length > 0;

  const firstJourney = hasData
    ? priced.map((j) => dayKeyOf(j.at)).reduce((a, k) => (k < a ? k : a))
    : today;
  const observedDays = span(firstJourney, today);
  const allTimeRate = totalEarned / observedDays;

  const cutoff = shiftDays(today, -RECENT_WINDOW_DAYS);
  const windowStart = cutoff > firstJourney ? cutoff : firstJourney;
  const recentJourneys = priced.filter((j) => dayKeyOf(j.at) >= windowStart);
  const recentEarned = recentJourneys.reduce((a, j) => a + (j.amount ?? 0), 0);
  const recentDays = span(windowStart, today);
  const recentRate = recentEarned / recentDays;

  // The forecast leans on the recent rate, falling back to the lifetime rate
  // when the recent window is empty — a fleet that has not synced in a month is
  // not the same thing as a fleet earning nothing, and projecting zero forward
  // would turn a sync gap into a false alarm.
  const usingFallback = recentJourneys.length === 0 && hasData;
  const rate = usingFallback ? allTimeRate : recentRate;

  // ── forecast ────────────────────────────────────────────────────────────
  const projectedRest = rate * daysLeft;
  const balance = projectedRest - remainingDue;
  const dailyGap = rate - requiredRemaining;
  const projectedMonth = earnedThisMonth + rate * (daysLeftInMonth - 1);
  const coverDays = rate > 0 ? remainingDue / rate : Infinity;
  const coverDate = Number.isFinite(coverDays)
    ? shiftDays(today, Math.ceil(coverDays))
    : null;

  // ── month-by-month ──────────────────────────────────────────────────────
  const past = plan.filter((i) => i.dueKey <= today);
  const withData = past
    .map((i) => ({ i, e: earnings.get(i.monthKey) }))
    .filter((x) => x.e && x.e.priced > 0) as { i: Instalment; e: MonthEarnings }[];
  const covered = withData.filter((x) => x.e.amount >= x.i.amount).length;
  const best = withData.length
    ? withData.reduce((a, x) => (x.e.amount > a.e.amount ? x : a))
    : null;
  const avgMonth = withData.length
    ? withData.reduce((a, x) => a + x.e.amount, 0) / withData.length
    : 0;
  const perJourney = priced.length ? totalEarned / priced.length : 0;
  const journeysPerDay = journeys.length / observedDays;

  return (
    <>
      <h2 style={{ margin: '34px 0 4px' }}>Required daily earnings</h2>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
        What the vehicle has to take per day to stay level with the loan.
      </p>
      <div className="grid" style={grid(210)}>
        <Tile
          label="Whole loan"
          value={`${rupees(requiredWhole)} / day`}
          note={`${rupees(totalDue)} spread over ${termDays.toLocaleString()} days`}
        />
        <Tile
          label="Remaining term"
          value={`${rupees(requiredRemaining)} / day`}
          note={`${rupees(remainingDue)} still to fall due over ${daysLeft.toLocaleString()} days`}
          accent
        />
        <Tile
          label="This month"
          value={thisRow ? `${rupees(monthDue / daysInMonth)} / day` : '—'}
          note={
            thisRow
              ? `${rupees(monthDue)} due ${dueDate(thisRow.dueKey)}, over ${daysInMonth} days`
              : 'no instalment falls due this month'
          }
        />
        <Tile
          label="Left to cover this month"
          value={
            thisRow
              ? stillNeeded === 0
                ? 'covered'
                : `${rupees(stillNeeded / daysLeftInMonth)} / day`
              : '—'
          }
          note={
            thisRow
              ? stillNeeded === 0
                ? `earnings already exceed the ${rupees(monthDue)} due`
                : `${rupees(stillNeeded)} short, ${daysLeftInMonth} day${daysLeftInMonth === 1 ? '' : 's'} left`
              : undefined
          }
        />
      </div>

      <h2 style={{ margin: '30px 0 4px' }}>Current earning rate</h2>
      {!hasData ? (
        <Box>
          <p className="muted" style={{ fontSize: 14 }}>
            No priced journey has synced yet, so there is no rate to measure and
            nothing to forecast from. The figures above are what the loan asks
            for regardless.
          </p>
        </Box>
      ) : (
        <>
          <div className="grid" style={grid(210)}>
            <Tile
              label={`Last ${RECENT_WINDOW_DAYS} days`}
              value={`${rupees(recentRate)} / day`}
              note={
                recentJourneys.length === 0
                  ? 'no journeys in this window'
                  : `${rupees(recentEarned)} over ${recentDays} day${recentDays === 1 ? '' : 's'}`
              }
              accent
            />
            <Tile
              label="Lifetime"
              value={`${rupees(allTimeRate)} / day`}
              note={`since ${dueDate(firstJourney)} · ${observedDays} day${observedDays === 1 ? '' : 's'}`}
            />
            <Tile
              label="Per journey"
              value={rupees(perJourney)}
              note={`${priced.length} priced of ${journeys.length} journey${journeys.length === 1 ? '' : 's'}`}
            />
            <Tile
              label="Journeys per day"
              value={journeysPerDay.toFixed(1)}
              note={`${journeys.length} journey${journeys.length === 1 ? '' : 's'} over ${observedDays} day${observedDays === 1 ? '' : 's'}`}
            />
          </div>

          <h2 style={{ margin: '30px 0 4px' }}>Forecast</h2>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
            Projected at {rupees(rate)} per day
            {usingFallback
              ? ' — the lifetime rate, since no journey landed in the recent window'
              : ` — the last ${RECENT_WINDOW_DAYS} days`}
            . A rate held steady for years is an assumption, not a prediction.
          </p>

          <Box style={{ borderColor: balance >= 0 ? 'var(--accent)' : 'var(--danger)', marginBottom: 14 }}>
            <div
              style={{
                fontSize: 15,
                color: balance >= 0 ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {balance >= 0 ? (
                <>
                  On track — projected to clear the remaining {rupees(remainingDue)}{' '}
                  with {rupees(balance)} to spare.
                </>
              ) : (
                <>
                  Short by {rupees(-balance)} over the remaining term — about{' '}
                  {rupees(-dailyGap)} per day under what is needed.
                </>
              )}
            </div>
          </Box>

          <div className="grid" style={grid(210)}>
            <Tile
              label="Projected, rest of term"
              value={rupees(projectedRest)}
              note={`against ${rupees(remainingDue)} falling due`}
            />
            <Tile
              label="Daily surplus"
              // Sign outside the currency, so +/− line up between the two cases
              // instead of reading "Rs -1,373.46".
              value={`${dailyGap >= 0 ? '+' : '−'}${rupees(Math.abs(dailyGap))}`}
              note={`earning ${rupees(rate)} against ${rupees(requiredRemaining)} needed`}
              accent={dailyGap >= 0}
            />
            <Tile
              label="This month projected"
              value={rupees(projectedMonth)}
              note={
                thisRow
                  ? projectedMonth >= monthDue
                    ? `covers the ${rupees(monthDue)} due`
                    : `${rupees(monthDue - projectedMonth)} under the instalment`
                  : 'no instalment this month'
              }
            />
            <Tile
              label="Remaining covered by"
              value={coverDate ? dueDate(coverDate) : '—'}
              note={
                coverDate
                  ? coverDate <= lastDue
                    ? `ahead of the final instalment on ${dueDate(lastDue)}`
                    : `past the final instalment on ${dueDate(lastDue)}`
                  : 'not at the current rate'
              }
            />
          </div>

          <h2 style={{ margin: '30px 0 4px' }}>Analysis</h2>
          <Box style={{ padding: 0 }}>
            <div className="scroll-x">
              <table>
                <tbody>
                  <tr>
                    <td className="muted" style={{ width: '45%' }}>Months with earnings recorded</td>
                    <td className="metric">
                      {withData.length} of {past.length} elapsed
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Months that covered their instalment</td>
                    <td className="metric">
                      {covered} of {withData.length}
                      {withData.length > 0 &&
                        ` · ${Math.round((covered / withData.length) * 100)}%`}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Best month</td>
                    <td className="metric">
                      {best ? `${rupees(best.e.amount)} · ${dueDate(best.i.dueKey)}` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Average month with data</td>
                    <td className="metric">{withData.length ? rupees(avgMonth) : '—'}</td>
                  </tr>
                  <tr>
                    <td className="muted">Earned to date</td>
                    <td className="metric">{rupees(totalEarned)}</td>
                  </tr>
                  <tr>
                    <td className="muted">Fallen due to date</td>
                    <td className="metric">
                      {rupees(past.reduce((a, i) => a + i.amount, 0))}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Instalments remaining</td>
                    <td className="metric">
                      {remaining.length} of {plan.length} · {rupees(remainingDue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Box>
        </>
      )}
    </>
  );
}
