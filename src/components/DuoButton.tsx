import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { feedback } from '../services/feedback';

type Variant = 'primary' | 'secondary' | 'blue' | 'danger' | 'outline';

const PALETTE: Record<Variant, { bg: string; shadow: string; text: string; border?: string }> = {
  primary: { bg: colors.primary, shadow: colors.primaryDark, text: colors.white },
  secondary: { bg: colors.secondary, shadow: colors.secondaryDark, text: colors.onSecondary },
  blue: { bg: colors.blue, shadow: colors.blueDark, text: colors.white },
  danger: { bg: colors.danger, shadow: colors.dangerDark, text: colors.white },
  outline: { bg: colors.white, shadow: colors.borderDark, text: colors.text, border: colors.borderDark },
};

const DEPTH = 5;

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  /** som tocado ao pressionar (padrão: tap) */
  sound?: 'tap' | 'success' | 'none';
}

/**
 * Botão "3D" estilo Duolingo: tem uma "sombra sólida" embaixo e,
 * ao pressionar, a face desce e encosta na base.
 */
export default function DuoButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
  sound = 'tap',
}: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const p = disabled ? { bg: colors.border, shadow: colors.borderDark, text: colors.textMuted } : PALETTE[variant];

  const to = (v: number) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 50, bounciness: v ? 0 : 10 }).start();

  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, DEPTH] });
  const height = small ? 42 : 54;

  return (
    <Pressable
      disabled={disabled || loading}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      onPress={() => {
        if (sound === 'tap') feedback.tap();
        if (sound === 'success') feedback.success();
        onPress?.();
      }}
      style={[{ height: height + DEPTH }, style]}
    >
      <View style={[styles.base, { height, backgroundColor: p.shadow, top: DEPTH, borderRadius: radius.md }]} />
      <Animated.View
        style={[
          styles.face,
          {
            height,
            backgroundColor: p.bg,
            borderRadius: radius.md,
            borderWidth: 'border' in p && p.border ? 2 : 0,
            borderColor: 'border' in p ? p.border : undefined,
            transform: [{ translateY }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.text} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={small ? 16 : 20} color={p.text} style={{ marginRight: 8 }} />}
            <Text style={[styles.text, { color: p.text, fontSize: small ? 14 : 16 }]}>{title.toUpperCase()}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  text: { fontWeight: '800', letterSpacing: 0.8 },
});
