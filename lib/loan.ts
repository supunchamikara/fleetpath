/**
 * The vehicle loan repayment schedule.
 *
 * One row per month, which is what lets the Earnings column line up: each
 * instalment is matched against the takings of the calendar month its due date
 * falls in.
 *
 * Everything about the schedule lives in `LOAN` below — edit that, not the
 * generator.
 */

export const LOAN = {
  /** Due date of the first instalment. */
  start: { year: 2026, month: 7, day: 15 },

  /** How many monthly instalments in total. */
  months: 60,

  /** The ordinary monthly instalment. */
  instalment: 55071.75,

  /**
   * Months that are not the ordinary instalment, keyed by month number.
   * These replace the instalment for that month rather than adding to it.
   */
  overrides: {
    36: 500000,
    48: 500000,
    60: 1002000,
  } as Record<number, number>,
};

export type Instalment = {
  /** 1-based month number, as in the original sheet. */
  month: number;
  /** Due date as written on the sheet, `YYYY-MM-DD`. */
  dueKey: string;
  /** The calendar month it is matched against, `YYYY-MM`. */
  monthKey: string;
  amount: number;
  /** True when this month differs from the ordinary instalment. */
  irregular: boolean;
};

/**
 * A due date is a date on a piece of paper, not a moment in time: the 15th of
 * July is the 15th of July wherever it is read. So the schedule is built from
 * plain calendar arithmetic and carried around as `YYYY-MM-DD` strings, which
 * no timezone can shift. Only the *journeys* it is compared against are real
 * instants, and those are converted to Sri Lankan calendar days on the way in.
 */
export function schedule(loan = LOAN): Instalment[] {
  const pad = (n: number) => String(n).padStart(2, '0');

  return Array.from({ length: loan.months }, (_, i) => {
    const month = i + 1;
    // Rolls into the following year on its own. The day is carried through
    // unchanged, so a start day past the 28th would land on a date February
    // does not have — keep the due day at 28 or lower.
    const index = loan.start.month - 1 + i;
    const year = loan.start.year + Math.floor(index / 12);
    const calendarMonth = (index % 12) + 1;
    const monthKey = `${year}-${pad(calendarMonth)}`;
    const override = loan.overrides[month];

    return {
      month,
      dueKey: `${monthKey}-${pad(loan.start.day)}`,
      monthKey,
      amount: override ?? loan.instalment,
      irregular: override !== undefined,
    };
  });
}
