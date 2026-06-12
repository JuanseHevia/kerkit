/** 4px-base spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

/** Minimum touch target (pt). Hard floor, not a suggestion. */
export const MIN_TOUCH_TARGET = 44;

/**
 * Shadows, sparingly: cards prefer hairline border + warm background
 * contrast over elevation. Shapes are RN-style; web renderers translate.
 */
export const shadows = {
  sm: {
    shadowColor: '#141311',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#141311',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#141311',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;
