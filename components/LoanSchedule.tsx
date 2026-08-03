import { Box } from '@/components/Blueprint';
import { monthKeyOf, rupees } from '@/lib/format';
import { type Instalment } from '@/lib/loan';

/** Takings for one calendar month. */
export type MonthEarnings = { amount: number; priced: number; trips: number };

/** `2026/07/15` — the format the original sheet uses, from a `YYYY-MM-DD` key. */
export const dueDate = (key: string) => key.replace(/-/g, '/');

export function LoanSchedule({
  plan,
  earnings,
}: {
  plan: Instalment[];
  earnings: Map<string, MonthEarnings>;
}) {
  const thisMonth = monthKeyOf(new Date());
  const totalDue = plan.reduce((a, i) => a + i.amount, 0);
  const totalEarned = [...earnings.values()].reduce((a, e) => a + e.amount, 0);

  return (
    <Box style={{ padding: 0 }}>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th style={{ width: 70 }}>Month</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Earnings</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((i) => {
              const e = earnings.get(i.monthKey);
              const current = i.monthKey === thisMonth;
              return (
                <tr
                  key={i.month}
                  style={current ? { background: 'var(--accent-100)' } : undefined}
                >
                  <td className="muted">{i.month}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dueDate(i.dueKey)}
                    {current && (
                      <span style={{ color: 'var(--accent)', fontSize: 12 }}> · this month</span>
                    )}
                  </td>
                  <td
                    className="metric"
                    style={{
                      textAlign: 'right',
                      // The sheet colour-codes the balloon payments; here they
                      // carry weight instead, so they still stand out among
                      // sixty near-identical rows.
                      color: i.irregular ? 'var(--accent)' : undefined,
                      fontWeight: i.irregular ? 600 : undefined,
                    }}
                  >
                    {rupees(i.amount)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right' }}>
                    {/* A month with no priced journey has unknown takings, not
                        zero — the same rule the rest of the dashboard follows. */}
                    {!e || e.priced === 0 ? <span className="muted">—</span> : rupees(e.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="muted">Total</td>
              <td className="metric" style={{ textAlign: 'right', fontWeight: 600 }}>
                {rupees(totalDue)}
              </td>
              <td className="metric" style={{ textAlign: 'right', fontWeight: 600 }}>
                {totalEarned === 0 ? '—' : rupees(totalEarned)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Box>
  );
}
