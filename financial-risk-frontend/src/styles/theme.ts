// ── Centralised chart theme ────────────────────────────────────────────────
// Uses CSS variables defined in index.css — auto-switches dark/light.

export const CHART_COLORS = {
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  green:  '#22c55e',
  yellow: '#f59e0b',
  red:    '#ef4444',
  gray:   '#6b7280',
};

export const CHART_GRID_COLOR = 'var(--color-grid)';
export const CHART_TICK_COLOR = 'var(--color-tick)';
export const CHART_TICK_SIZE  = 11;

export const TOOLTIP_STYLE = {
  contentStyle: {
    background:   'var(--color-surface)',
    border:       '1px solid var(--color-border-strong)',
    borderRadius: 8,
    color:        'var(--color-text-primary)',
  },
  labelStyle: { color: 'var(--color-text-primary)' },
  itemStyle:  { color: 'var(--color-text-secondary)' },
};
