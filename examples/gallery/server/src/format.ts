/** Render any fixture value as a display string (Dates → ISO), or null if empty. */
export function fmtValue(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Serialize an entity into a flat { field: displayString | null } map. */
export function serializeEntity(e: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(e)) out[k] = fmtValue(v);
  return out;
}
