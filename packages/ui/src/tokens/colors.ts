import type { AuthorizationStatus } from '@kerkit/core';

/**
 * "Calm Confidence" palette. Warm undertones throughout — never cold blues
 * or clinical teal. The green is reserved for forward progress; see
 * `semantic.action` below for the philosophy encoded as naming.
 */
export const palette = {
  green: {
    50: '#F0F7F4',
    100: '#D5EDDF',
    200: '#A8D9BC',
    300: '#72BF96',
    400: '#4BA879',
    500: '#2E8B5E',
    600: '#247048',
    700: '#1B5636',
    800: '#123B25',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAF8',
    100: '#F3F2EE',
    200: '#E5E3DD',
    300: '#D1CEC5',
    400: '#A8A49A',
    500: '#7D796F',
    600: '#5A5750',
    700: '#3D3B37',
    800: '#252420',
    900: '#141311',
  },
  accent: {
    blue: '#4A90A4',
    warm: '#C4956A',
  },
} as const;

/**
 * Semantic tokens — use these, not the raw palette. The names carry the
 * design rules: `action.forward` is the ONLY green surface; if a use isn't
 * forward progress (confirm, advance, complete), it doesn't get green.
 */
export const semantic = {
  action: {
    /** Forward-progress actions only: confirm, advance, save. Never decoration. */
    forward: palette.green[500],
    forwardPressed: palette.green[600],
    forwardSubtle: palette.green[100],
  },
  surface: {
    page: palette.neutral[50],
    card: palette.neutral[0],
    input: palette.neutral[0],
    border: palette.neutral[200],
  },
  text: {
    primary: palette.neutral[800],
    secondary: palette.neutral[500],
    onForward: palette.neutral[0],
  },
} as const;

/**
 * Authorization-status colors, keyed by the core status union. Foreground /
 * background pairs verified for WCAG 2.1 AA. Display labels come from the
 * locale pack (`status.authorization.badge.*` copy keys), never from here.
 */
export const statusColors: Record<AuthorizationStatus, { bg: string; fg: string }> = {
  needed: { bg: '#E8DFF0', fg: '#6B4C8A' },
  requested: { bg: '#FFF3E0', fg: '#B8730E' },
  pending: { bg: '#FFF8E1', fg: '#9C8A1B' },
  confirmed: { bg: '#E8F5E9', fg: '#2E7D32' },
  escalation: { bg: '#FBE9E7', fg: '#C62828' },
};

/** Dark-mode overrides for the semantic surfaces. */
export const darkSemantic = {
  surface: {
    page: '#1A1917',
    card: '#252420',
    input: palette.neutral[800],
    border: palette.neutral[700],
  },
  text: {
    primary: palette.neutral[100],
    secondary: palette.neutral[400],
    onForward: palette.neutral[0],
  },
  action: {
    forward: palette.green[400],
    forwardPressed: palette.green[500],
    forwardSubtle: palette.green[800],
  },
} as const;
