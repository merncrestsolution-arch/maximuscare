// src/theme/colors.ts — Maximus Care Brand Colours
export const Colors = {
  // Blue Scale
  blueDark:     '#105691',
  bluePrimary:  '#1873A8',
  blueMid:      '#1B7EB7',
  blueLight:    '#6495B6',
  bluePale:     '#EEF5FB',

  // Orange Scale
  orangePrimary: '#F45627',
  orangeWarm:    '#EE862D',
  orangeLight:   '#F19F39',

  // Neutrals
  white:         '#FFFFFF',
  greyLight:     '#F4F6F8',
  greyMid:       '#94A3B8',
  greyDark:      '#334155',
  black:         '#1E293B',

  // Semantic
  success:       '#16A34A',
  warning:       '#EE862D',
  error:         '#DC2626',
  info:          '#1873A8',

  // Surfaces
  pageBg:        '#EEF5FB',
  cardBg:        '#FFFFFF',
  cardBorder:    '#D6E8F5',
  sidebarBg:     '#105691',
  headerBg:      '#FFFFFF',
} as const;

export const Typography = {
  heading: { fontSize: 20, fontWeight: '700' as const, color: '#105691' },
  subheading: { fontSize: 16, fontWeight: '600' as const, color: '#105691' },
  body: { fontSize: 14, fontWeight: '400' as const, color: '#1E293B' },
  caption: { fontSize: 12, fontWeight: '400' as const, color: '#94A3B8' },
  label: { fontSize: 13, fontWeight: '600' as const, color: '#105691' },
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
} as const;

export const BorderRadius = {
  sm: 6, md: 8, lg: 12, xl: 16, full: 999,
} as const;
