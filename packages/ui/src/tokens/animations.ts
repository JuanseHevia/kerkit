/** Motion: quick and quiet. Nothing bounces; nothing draws attention to itself. */
export const durations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

/** Cubic-bezier control points. */
export const easings = {
  out: [0.0, 0.0, 0.2, 1] as const,
  in: [0.4, 0.0, 1, 1] as const,
  inOut: [0.4, 0.0, 0.2, 1] as const,
} as const;
