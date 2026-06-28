// src/theme/components.ts
import { StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius } from './colors';

export const GlobalStyles = StyleSheet.create({
  // Screen background
  screen: {
    flex: 1,
    backgroundColor: Colors.pageBg,   // #EEF5FB
  },

  // Card
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,    // 12
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    shadowColor: Colors.blueDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: Spacing.md,
  },

  // Card title
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.blueDark,           // #105691
    marginBottom: Spacing.sm,
  },

  // Primary Button — ORANGE
  btnPrimary: {
    backgroundColor: Colors.orangePrimary,  // #F45627
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
    flexDirection: 'row' as const,
    gap: 6,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // Secondary Button — Blue outline
  btnSecondary: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.bluePrimary,   // #1873A8
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
  },
  btnSecondaryText: {
    color: Colors.bluePrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Input field
  input: {
    borderWidth: 1.5,
    borderColor: Colors.blueLight,    // #6495B6
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.black,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: Colors.bluePrimary,  // #1873A8
    shadowColor: Colors.bluePrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.blueDark,           // #105691
    marginBottom: 5,
  },

  // Page header
  pageHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bluePale,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.blueDark,
  },

  // Table header row
  tableHeaderRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.blueDark,  // #105691
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  tableHeaderCell: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },

  // Status badges
  badgeBlue: {
    backgroundColor: Colors.bluePale,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeBlueText: { color: Colors.blueDark, fontSize: 12, fontWeight: '600' },

  badgeOrange: {
    backgroundColor: '#FFF3ED',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeOrangeText: { color: Colors.orangePrimary, fontSize: 12, fontWeight: '600' },

  badgeSuccess: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeSuccessText: { color: Colors.success, fontSize: 12, fontWeight: '600' },
});
