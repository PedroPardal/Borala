import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

/** Cartão com borda inferior grossa (visual "chunky" estilo Duolingo). */
export default function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export const cardStyle = {
  backgroundColor: colors.card,
  borderRadius: radius.lg,
  borderWidth: 2,
  borderBottomWidth: 5,
  borderColor: colors.border,
  padding: spacing.lg,
};

const styles = StyleSheet.create({ card: cardStyle });
