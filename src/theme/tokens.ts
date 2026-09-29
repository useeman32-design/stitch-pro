/**
 * StitchPro — Central Design Tokens
 * -----------------------------------------------------------------------
 * Single source of truth for color, spacing, radius, typography, shadows
 * and sizing. Never hardcode raw hex/px values inside screens or
 * components — import from here instead so the whole app stays visually
 * consistent and re-themeable.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// COLOR
// ---------------------------------------------------------------------------

export const colors = {
  // Brand
  navy: '#0B0E1A', // deep navy / near-black — sidebar, hero, branding
  navyElevated: '#141834', // slightly lighter navy surface (cards on navy)
  navySoft: '#1B2040', // borders / dividers on navy surfaces
  indigo: '#5B4FE8', // electric indigo — primary actions
  indigoDark: '#4A3FD1', // pressed / gradient end
  indigoLight: '#8A7FF0', // hover / gradient accents
  indigoTint: '#EEECFE', // very light indigo background tint
  blue: '#3E7BFA', // subtle supporting blue
  blueTint: '#EAF1FF',

  // Neutrals
  white: '#FFFFFF',
  gray25: '#FBFBFD',
  gray50: '#F6F7FA',
  gray100: '#F0F1F5',
  gray200: '#E4E6EC',
  gray300: '#D3D6DF',
  gray400: '#AEB2C0',
  gray500: '#888D9E',
  gray600: '#666B7D',
  gray700: '#484D5E',
  gray800: '#2C3040',
  gray900: '#181B26',

  // Semantic
  success: '#1FAE6A',
  successTint: '#E5F7EE',
  warning: '#F2A93B',
  warningTint: '#FCF1E0',
  danger: '#E5484D',
  dangerTint: '#FBEAEB',
  info: '#3E7BFA',
  infoTint: '#EAF1FF',

  // Aliases used across the app
  background: '#F6F7FA', // main app background (light workspace)
  surface: '#FFFFFF', // card / sheet surface
  border: '#E7E9EF',
  textPrimary: '#12141F',
  textSecondary: '#666B7D',
  textTertiary: '#9498A6',
  textOnNavy: '#FFFFFF',
  textOnNavySecondary: '#A9AEC7',
} as const;

export const gradients = {
  indigo: [colors.indigo, colors.indigoDark] as const,
  indigoSubtle: [colors.indigoLight, colors.indigo] as const,
  navy: [colors.navy, '#171B34'] as const,
  navyHero: ['#0B0E1A', '#1B2050', '#2B2470'] as const,
  heroPromo: ['#090B16', '#2A2470', '#3E63E0'] as const,
};

// ---------------------------------------------------------------------------
// SPACING
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

// ---------------------------------------------------------------------------
// RADIUS
// ---------------------------------------------------------------------------

export const radius = {
  xs: 8,
  sm: 10,
  button: 12,
  input: 14,
  md: 14,
  card: 18,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// ---------------------------------------------------------------------------

export const fontFamily = Platform.select({
  default: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
});

export const typography = {
  pageTitle: { fontSize: 30, lineHeight: 38, fontFamily: fontFamily!.bold },
  h1: { fontSize: 28, lineHeight: 36, fontFamily: fontFamily!.bold },
  h2: { fontSize: 22, lineHeight: 29, fontFamily: fontFamily!.semibold },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily!.semibold },
  cardTitle: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily!.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily!.regular },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily!.medium },
  bodySmall: { fontSize: 13, lineHeight: 19, fontFamily: fontFamily!.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily!.medium },
  tiny: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily!.medium },
  button: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily!.semibold },
} as const;

// ---------------------------------------------------------------------------
// SHADOWS
// ---------------------------------------------------------------------------

export const shadows = {
  none: {},
  xs: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(15, 18, 40, 0.05)' },
    default: {
      shadowColor: '#0B0E1A',
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  }),
  card: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(15, 18, 40, 0.07)' },
    default: {
      shadowColor: '#0B0E1A',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  }),
  raised: Platform.select({
    web: { boxShadow: '0 14px 30px rgba(91, 79, 232, 0.35)' },
    default: {
      shadowColor: colors.indigo,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  }),
  sheet: Platform.select({
    web: { boxShadow: '0 -12px 32px rgba(15, 18, 40, 0.16)' },
    default: {
      shadowColor: '#0B0E1A',
      shadowOpacity: 0.16,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -6 },
      elevation: 12,
    },
  }),
} as const;

// ---------------------------------------------------------------------------
// SIZES
// ---------------------------------------------------------------------------

export const sizes = {
  inputHeight: 52,
  buttonHeight: 52,
  buttonHeightSm: 40,
  headerHeight: 76,
  sidebarWidth: 272,
  sidebarCollapsedWidth: 88,
  bottomNavHeight: 64,
  createButtonSize: 64,
  maxContentWidth: 1280,
} as const;

export const breakpoints = {
  tablet: 768,
  desktop: 1024,
  // Below this, the desktop sidebar shell stays, but multi-column page
  // layouts (e.g. Dashboard's main + side rail) stack into a single column
  // instead of squeezing — prevents cramped text-wrap on laptop-width windows.
  wide: 1200,
} as const;
