import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, makeStyles } from '../theme';

/** Cartão com borda inferior grossa (visual "chunky" estilo Duolingo). */
export default function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Estilo base do cartão. É uma função para acompanhar o tema: use dentro de `makeStyles`. */
export const cardStyle = () => ({
  backgroundColor: colors.card,
  borderRadius: radius.lg,
  borderWidth: 2,
  borderBottomWidth: 5,
  borderColor: colors.border,
  padding: spacing.lg,
});

const styles = makeStyles(() => ({ card: cardStyle() }));
