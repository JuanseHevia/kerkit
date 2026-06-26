const DATE = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
const DATETIME = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return DATE.format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return DATETIME.format(new Date(iso));
}

export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Pretty-print a tool result value for the assistant trace. */
export function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
