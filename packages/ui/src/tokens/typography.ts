/**
 * Typography: DM Sans for UI, Source Serif 4 for display/editorial moments.
 * Framework-agnostic: families are described as data; the RN binding (or any
 * other renderer) resolves the platform-specific font name.
 */
export interface FontFamilyToken {
  /** CSS-style family name (web). */
  family: string;
  /** PostScript names per weight (iOS/Android embedded fonts). */
  postScript: Record<string, string>;
}

export const fontFamilies = {
  display: {
    family: 'Source Serif 4',
    postScript: { regular: 'SourceSerif4-Regular', semiBold: 'SourceSerif4-SemiBold' },
  },
  sans: {
    family: 'DM Sans',
    postScript: { regular: 'DMSans-Regular', medium: 'DMSans-Medium', semiBold: 'DMSans-SemiBold' },
  },
  mono: {
    family: 'JetBrains Mono',
    postScript: { regular: 'JetBrainsMono-Regular' },
  },
} as const satisfies Record<string, FontFamilyToken>;

export type TypeRole = keyof typeof typeScale;

/**
 * Type scale. `font` names a family token + weight; never go below regular
 * weight, and never below 11px (body floor for stressed readers is 15+).
 */
export const typeScale = {
  display: { fontSize: 32, lineHeight: 40, font: 'display', weight: 'semiBold' },
  h1: { fontSize: 26, lineHeight: 34, font: 'display', weight: 'semiBold' },
  h2: { fontSize: 22, lineHeight: 30, font: 'sans', weight: 'semiBold' },
  h3: { fontSize: 18, lineHeight: 26, font: 'sans', weight: 'semiBold' },
  bodyLg: { fontSize: 17, lineHeight: 26, font: 'sans', weight: 'regular' },
  body: { fontSize: 15, lineHeight: 24, font: 'sans', weight: 'regular' },
  bodySm: { fontSize: 13, lineHeight: 20, font: 'sans', weight: 'regular' },
  caption: { fontSize: 12, lineHeight: 16, font: 'sans', weight: 'medium' },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    font: 'sans',
    weight: 'semiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
} as const;

/** Resolve a type role to a concrete font name for native platforms. */
export function resolveFontName(role: TypeRole, platform: 'ios' | 'android' | 'web'): string {
  const def = typeScale[role];
  const familyToken = fontFamilies[def.font as keyof typeof fontFamilies];
  if (platform === 'web') return familyToken.family;
  return (
    (familyToken.postScript as Record<string, string>)[def.weight] ??
    Object.values(familyToken.postScript)[0]
  );
}
