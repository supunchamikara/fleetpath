'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box } from '@/components/Blueprint';
import { EMPTY, activeCount, type TripFilters } from '@/lib/tripFilters';

type Draft = Record<string, string>;

const toDraft = (f: TripFilters): Draft =>
  Object.fromEntries(
    Object.entries(f).map(([k, v]) => [k, v == null ? '' : String(v)]),
  );

/** min/max pair for one numeric column. */
const RANGES: { label: string; unit: string; min: keyof TripFilters; max: keyof TripFilters }[] = [
  { label: 'Amount', unit: 'Rs', min: 'amin', max: 'amax' },
  { label: 'Distance', unit: 'km', min: 'dmin', max: 'dmax' },
  { label: 'Time', unit: 'min', min: 'tmin', max: 'tmax' },
  { label: 'Avg speed', unit: 'km/h', min: 'vmin', max: 'vmax' },
  { label: 'Max speed', unit: 'km/h', min: 'xmin', max: 'xmax' },
];

export function TripFiltersBar({
  filters,
  size,
  matched,
}: {
  filters: TripFilters;
  size: number;
  /** How many journeys the current filters match, for the summary line. */
  matched: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const active = activeCount(filters);
  // Open by default when something is filtering, so a narrowed list never looks
  // like the whole table with rows missing.
  const [open, setOpen] = useState(active > 0);
  const [draft, setDraft] = useState<Draft>(toDraft(filters));

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  function apply(next: Draft = draft) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v.trim() !== '') p.set(k, v.trim());
    // Back to page 1: with a different result set, the old page number points
    // at rows that are no longer there.
    p.set('page', '1');
    p.set('size', String(size));
    router.push(`${pathname}?${p.toString()}`);
  }

  function clear() {
    setDraft(toDraft(EMPTY));
    router.push(`${pathname}?page=1&size=${size}`);
  }

  const field = (k: string, placeholder: string) => (
    <input
      className="input"
      inputMode="decimal"
      value={draft[k] ?? ''}
      placeholder={placeholder}
      onChange={(e) => set(k, e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && apply()}
      style={{ padding: '4px 8px', width: '100%', minWidth: 0, flex: 1 }}
    />
  );

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          className={active > 0 ? 'btn btn-primary' : 'btn'}
          onClick={() => setOpen((o) => !o)}
          style={{ padding: '4px 12px', fontSize: 12.5 }}
        >
          {open ? 'Hide filters' : 'Filters'}
          {active > 0 && ` (${active})`}
        </button>
        {active > 0 && (
          <>
            <span className="muted" style={{ fontSize: 13 }}>
              {matched} journey{matched === 1 ? '' : 's'} match
            </span>
            <button
              className="btn"
              onClick={clear}
              style={{ padding: '4px 12px', fontSize: 12.5 }}
            >
              Clear
            </button>
          </>
        )}
      </div>

      {open && (
        <Box style={{ marginTop: 10 }}>
          {/* Date sits on its own row. A `type=date` input has a wide
              intrinsic minimum — two of them shared a grid cell with the
              numeric ranges and pushed straight through it. */}
          <div style={{ maxWidth: 420 }}>
            <label className="muted" style={{ fontSize: 12 }}>DATE</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <input
                className="input"
                type="date"
                value={draft.from ?? ''}
                onChange={(e) => set('from', e.target.value)}
                style={{ padding: '4px 8px', flex: '1 1 170px', minWidth: 0 }}
              />
              <input
                className="input"
                type="date"
                value={draft.to ?? ''}
                onChange={(e) => set('to', e.target.value)}
                style={{ padding: '4px 8px', flex: '1 1 170px', minWidth: 0 }}
              />
            </div>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            {RANGES.map((r) => (
              <div key={r.label} style={{ minWidth: 0 }}>
                <label className="muted" style={{ fontSize: 12 }}>
                  {r.label.toUpperCase()} ({r.unit})
                </label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {field(r.min, 'min')}
                  {field(r.max, 'max')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => apply()} style={{ fontSize: 13 }}>
              Apply
            </button>
            <button className="btn" onClick={clear} style={{ fontSize: 13 }}>
              Clear all
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Dates are Sri Lankan calendar days and include both ends. Blank means
            no bound.
          </p>
        </Box>
      )}
    </div>
  );
}
