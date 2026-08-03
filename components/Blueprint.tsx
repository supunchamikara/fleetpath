import type { ReactNode, CSSProperties } from 'react';

/** Hairline square box with the kit's four corner registration marks. */
export function Box({
  children,
  style,
  highlight = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  highlight?: boolean;
}) {
  return (
    <div
      className="bp"
      style={{
        padding: 16,
        background: highlight ? 'var(--accent-100)' : undefined,
        borderColor: highlight ? 'var(--accent)' : undefined,
        ...style,
      }}
    >
      <i className="bp-corner tl" />
      <i className="bp-corner tr" />
      <i className="bp-corner bl" />
      <i className="bp-corner br" />
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <Box highlight={highlight}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: highlight ? 'var(--accent-800)' : 'rgba(29,31,32,0.55)',
        }}
      >
        {label}
      </div>
      <div
        className="metric"
        style={{
          fontSize: 30,
          marginTop: 4,
          color: highlight ? 'var(--accent-900)' : undefined,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 13, fontWeight: 400 }} className="muted">
            {' '}
            {unit}
          </span>
        )}
      </div>
    </Box>
  );
}
