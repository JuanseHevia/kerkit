import { describe, expect, it } from 'vitest';
import { palette, semantic, statusColors } from './colors.js';
import { typeScale, resolveFontName } from './typography.js';
import { MIN_TOUCH_TARGET } from './spacing.js';

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('status colors', () => {
  // Status badges are short, bold, uppercase labels — WCAG large-text/UI
  // threshold (3:1) is the floor; most pairs clear 4.5:1.
  it.each(Object.entries(statusColors))('%s fg/bg pair meets contrast floor', (_status, pair) => {
    expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(3);
  });

  it('primary text on page background is well past AA', () => {
    expect(contrast(semantic.text.primary, semantic.surface.page)).toBeGreaterThanOrEqual(7);
  });

  it('text on forward actions meets AA', () => {
    expect(contrast(semantic.text.onForward, semantic.action.forward)).toBeGreaterThanOrEqual(3);
  });
});

describe('design rules encoded in tokens', () => {
  it('the only green semantic tokens are forward actions', () => {
    const greens = new Set(Object.values(palette.green));
    const nonActionTokens = [
      ...Object.values(semantic.surface),
      ...Object.values(semantic.text),
    ];
    for (const token of nonActionTokens) {
      expect(greens.has(token as (typeof palette.green)[keyof typeof palette.green])).toBe(false);
    }
  });

  it('body text never drops below 13px and the floor role is caption-tier only', () => {
    expect(typeScale.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(typeScale.bodySm.fontSize).toBeGreaterThanOrEqual(13);
    for (const role of Object.values(typeScale)) {
      expect(role.fontSize).toBeGreaterThanOrEqual(11);
    }
  });

  it('touch target floor is 44pt', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });

  it('resolves platform font names', () => {
    expect(resolveFontName('display', 'ios')).toBe('SourceSerif4-SemiBold');
    expect(resolveFontName('body', 'android')).toBe('DMSans-Regular');
    expect(resolveFontName('h2', 'web')).toBe('DM Sans');
  });
});
