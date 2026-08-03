import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { Box } from '@/components/Blueprint';
import { monthKey, rupees } from '@/lib/format';
import { LOAN, schedule } from '@/lib/loan';
import { LoanSchedule, dueDate, type MonthEarnings } from '@/components/LoanSchedule';
import { LoanAnalysis, type Journey } from '@/components/LoanAnalysis';

export const dynamic = 'force-dynamic';

export default async function LoanPage() {
  const supabase = createClient(await cookies());

  // Only the two columns the earnings column needs. No limit: a schedule that
  // silently dropped older months would misreport what was earned against them.
  const { data, error, count } = await supabase
    .from('trips')
    .select('start_time, amount', { count: 'exact' });

  if (error) {
    return (
      <Box style={{ borderColor: 'var(--danger)' }}>
        <h3>Could not load earnings</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{error.message}</p>
      </Box>
    );
  }

  const rows = (data ?? []) as { start_time: string; amount: number | null }[];
  const truncated = count != null && rows.length < count;

  // Takings per calendar month, in the viewer's own timezone so the buckets
  // match the due dates shown beside them.
  const earnings = new Map<string, MonthEarnings>();
  for (const t of rows) {
    // Bucketed by the Sri Lankan calendar month the journey happened in, so it
    // lines up with the due date printed beside it.
    const key = monthKey(t.start_time);
    const e = earnings.get(key) ?? { amount: 0, priced: 0, trips: 0 };
    e.trips += 1;
    if (t.amount != null) {
      e.amount += t.amount;
      e.priced += 1;
    }
    earnings.set(key, e);
  }

  const plan = schedule();
  const journeys: Journey[] = rows.map((t) => ({
    at: new Date(t.start_time),
    amount: t.amount,
  }));

  const totalDue = plan.reduce((a, i) => a + i.amount, 0);
  const totalEarned = [...earnings.values()].reduce((a, e) => a + e.amount, 0);

  return (
    <>
      <div className="kicker">Vehicle loan</div>
      <h1 style={{ margin: '4px 0 6px' }}>Loan &amp; earnings</h1>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 680, marginBottom: 16 }}>
        {LOAN.months} monthly instalments from {dueDate(plan[0].dueKey)} to{' '}
        {dueDate(plan[plan.length - 1].dueKey)}, measured against what the vehicle
        is actually taking.
      </p>

      {truncated && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>
            Only {rows.length} of {count} journeys were returned, so the earnings
            column is incomplete.
          </span>
        </Box>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 20 }}
      >
        <Box>
          <div className="kicker">Total repayable</div>
          <div className="metric" style={{ fontSize: 26, marginTop: 8 }}>{rupees(totalDue)}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            over {LOAN.months} months
          </div>
        </Box>
        <Box>
          <div className="kicker">Ordinary instalment</div>
          <div className="metric" style={{ fontSize: 26, marginTop: 8 }}>
            {rupees(LOAN.instalment)}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            {Object.keys(LOAN.overrides).length} month
            {Object.keys(LOAN.overrides).length === 1 ? '' : 's'} differ
          </div>
        </Box>
        <Box style={{ borderColor: 'var(--accent)' }}>
          <div className="kicker">Earnings recorded</div>
          <div className="metric" style={{ fontSize: 26, marginTop: 8, color: 'var(--accent)' }}>
            {totalEarned === 0 ? '—' : rupees(totalEarned)}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            across every synced journey
          </div>
        </Box>
      </div>

      <LoanAnalysis plan={plan} earnings={earnings} journeys={journeys} />

      <h2 style={{ margin: '30px 0 4px' }}>Repayment schedule</h2>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 680, marginBottom: 12 }}>
        Earnings are filled in from the journeys recorded in the calendar month
        each instalment falls due, so a month with no priced journey reads “—”
        rather than zero.
      </p>
      <LoanSchedule plan={plan} earnings={earnings} />

    </>
  );
}
