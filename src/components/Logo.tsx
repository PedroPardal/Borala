import React from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

/** Ícone do app (pin + aperto de mão) com cantos arredondados. */
export function LogoMark({ size = 88, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.28, overflow: 'hidden' }, style]}>
      <Image source={require('../../assets/logo.png')} style={{ width: size, height: size }} />
    </View>
  );
}

/** Logotipo em texto: "bora lá" com o ponto laranja. */
export function Wordmark({ size = 36, color = colors.white, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.word, { fontSize: size, color }, style]}>
      bora lá<Text style={{ color: colors.primary }}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  word: { fontWeight: '900', letterSpacing: -1 },
});
